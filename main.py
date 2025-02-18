import hashlib
import io
import logging
import re
import threading
import time
from contextlib import contextmanager, redirect_stdout
from dataclasses import dataclass
from pathlib import Path
from queue import Queue, Full, Empty
from typing import List, Optional, Set

import numpy as np
import sounddevice as sd
import soundfile as sf
import spacy
import torch
from TTS.api import TTS
from ollama import Client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)


@dataclass
class Config:
    thread_timeout: int = 10
    audio_dir: Path = Path("audio_cache")
    ollama_host: str = "http://localhost:11434"
    ollama_llm: str = "gemma2:latest"
    max_queue_size: int = 1000
    audio_sample_rate: int = 44100
    model_name: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    voice_file: str = "voice.wav"


@dataclass
class AudioTextPair:
    text: str
    audio_path: Path


class AudioProcessingError(Exception):
    """Custom exception for audio processing errors."""
    pass


class torch_load_context:
    """Context manager for temporarily modifying torch.load behavior."""

    def __init__(self, weights_only: bool):
        self.weights_only = weights_only
        self.original_load = None

    def __enter__(self):
        self.original_load = torch.load
        torch.load = lambda *args, **kwargs: self.original_load(
            *args, **kwargs, weights_only=self.weights_only
        )

    def __exit__(self, exc_type, exc_val, exc_tb):
        torch.load = self.original_load


class AudioFileManager:
    """Manages temporary audio file creation and cleanup."""

    def __init__(self, audio_dir: Path):
        self.audio_dir = audio_dir
        self.audio_dir.mkdir(exist_ok=True)
        self.pending_files: Set[Path] = set()

    @contextmanager
    def temporary_audio_file(self):
        """Context manager for temporary audio file creation and cleanup."""
        temp_file = self.audio_dir / f"{time.time()}_{threading.get_ident()}.wav"
        self.pending_files.add(temp_file)
        logging.debug(f"Created temporary audio file: {temp_file}")
        try:
            yield temp_file
        except Exception:
            self.pending_files.discard(temp_file)
            if temp_file.exists():
                temp_file.unlink()
            raise

    def cleanup_file(self, file_path: Path):
        """Clean up a single file after it's been played."""
        if file_path in self.pending_files:
            self.pending_files.discard(file_path)
            try:
                if file_path.exists():
                    file_path.unlink()
                    logging.debug(f"Cleaned up audio file: {file_path}")
            except OSError as e:
                logging.warning(f"Failed to delete temporary file {file_path}: {e}")

    def cleanup(self):
        """Remove all temporary audio files."""
        for file in self.audio_dir.glob("*.wav"):
            try:
                file.unlink()
                logging.debug(f"Deleted file during cleanup: {file}")
            except OSError as e:
                logging.warning(f"Failed to delete {file}: {e}")
        self.pending_files.clear()


class BoundedQueue:
    """Thread-safe bounded queue implementation."""

    def __init__(self, maxsize: int = 1000):
        self.queue = Queue(maxsize=maxsize)

    def put(self, item, timeout: float = 1) -> bool:
        try:
            self.queue.put(item, timeout=timeout)
            logging.debug(f"Item enqueued: {item}")
            return True
        except Full:
            logging.warning("Queue is full, dropping item")
            return False

    def get(self, timeout: float = 1):
        try:
            item = self.queue.get(timeout=timeout)
            logging.debug(f"Item dequeued: {item}")
            return item
        except Empty:
            return None

    def empty(self) -> bool:
        return self.queue.empty()


class TextProcessor:
    """Handles text processing and section splitting."""

    def __init__(self, config: Config):
        self.config = config
        self.nlp = spacy.load('en_core_web_sm')

    def destop_words(self, text: str) -> str:
        """Remove stopwords from a list of tokens."""
        return ' '.join(token.text for token in self.nlp(text) if not token.is_stop)

    def split_into_sections(self, text: str) -> List[str]:
        """Split text into meaningful sections based on paragraphs."""
        if not text:
            logging.warning("Received empty text to split into sections")
            return []

        TARGET_WORDS = 250
        MIN_SECTION_LENGTH = 50

        try:
            text = re.sub(r'\s+', ' ', text).strip()
            doc = self.nlp(text)

            sections = []
            current_section = []
            current_word_count = 0

            for sent in doc.sents:
                sentence_words = len([token for token in sent if not token.is_space])

                if current_word_count + sentence_words > TARGET_WORDS and current_section:
                    section_text = ' '.join(current_section).strip()
                    if section_text:
                        sections.append(section_text)
                        logging.debug(f"Created section with {current_word_count} words")
                    current_section = []
                    current_word_count = 0

                current_section.append(sent.text)
                current_word_count += sentence_words

                if current_word_count > TARGET_WORDS * 1.5 and len(current_section) == 1:
                    section_text = ' '.join(current_section).strip()
                    if section_text:
                        sections.append(section_text)
                        logging.debug(f"Created oversized section with {current_word_count} words")
                    current_section = []
                    current_word_count = 0

            if current_section:
                remaining_text = ' '.join(current_section).strip()
                if remaining_text:
                    if (current_word_count < MIN_SECTION_LENGTH and sections
                            and len(sections[-1].split()) + current_word_count <= TARGET_WORDS * 1.2):
                        sections[-1] = f"{sections[-1]} {remaining_text}"
                        logging.debug(f"Merged short final section with previous section")
                    else:
                        sections.append(remaining_text)
                        logging.debug(f"Created final section with {current_word_count} words")

            if not sections:
                logging.warning("No sections were created from the input text")

            return sections

        except Exception as e:
            logging.error(f"Error in split_into_sections: {e}", exc_info=True)
            raise AudioProcessingError(f"Failed to split text into sections: {e}")

    def extract_sentences(self, text: str) -> List[str]:
        """Extract complete sentences from text."""
        if not text:
            logging.warning("Received empty text to extract sentences")
            return []

        try:
            doc = self.nlp(str(text))
            sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
            logging.debug(f"Extracted {len(sentences)} sentences")
            return sentences
        except Exception as e:
            logging.error(f"Error in extract_sentences: {e}", exc_info=True)
            return []


class TTSEngine:
    """Handles text-to-speech conversion."""

    def __init__(self, config: Config):
        self.config = config
        self.tts = None
        self.stdout_capture = io.StringIO()
        self.initialize_tts()

    def initialize_tts(self):
        """Initialize the TTS engine."""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        with torch_load_context(weights_only=False):
            try:
                with redirect_stdout(self.stdout_capture):
                    self.tts = TTS(self.config.model_name).to(device)
                    logging.info(f"TTS engine initialized on {device}")
            except Exception as e:
                logging.error(f"Failed to initialize TTS: {e}", exc_info=True)
                raise

    def generate_speech(self, text: str, output_path: Path):
        """Generate speech from text and save to file."""
        try:
            logging.debug(f"Generating speech for text: {text}")
            with redirect_stdout(self.stdout_capture):
                self.tts.tts_to_file(
                    text=text,
                    speaker_wav=self.config.voice_file,
                    language="en",
                    file_path=str(output_path),
                    split_sentences=False,
                )
                logging.debug(f"Speech generated and saved to: {output_path}")
        except Exception as e:
            logging.error(f"Speech generation failed: {e}", exc_info=True)
            raise AudioProcessingError(f"Failed to generate speech: {e}")


class OllamaClient:
    """Handles communication with Ollama API."""

    def __init__(self, config: Config):
        self.client = Client(
            host=config.ollama_host,
            headers={'x-some-header': 'some-value'}
        )
        self.model = config.ollama_llm

    def get_summary(self, last_section: str, text: str) -> str:
        """Get an engaging summary from Ollama."""
        base_prompt = f"""
        Imagine you're explaining this content to an interested friend who's smart but not an expert in the field. Create an engaging summary that:
        1. Sets the scene and introduces the main ideas like you're telling a story
        2. Explains key concepts using relatable analogies or examples where appropriate
        3. Connects different parts of the content in a natural, flowing way
        4. Highlights the most interesting or surprising elements
        5. Wraps up by emphasizing why this matters or what we learned

        Keep the tone conversational but informative. Aim for about 200-300 words.
        """
        if last_section:
            context_prompt = f"""
            Important: This is a continuation of a longer text. Here's what was covered in the previous section:
            {last_section}
            Please make your summary flow naturally from the previous content, to maintain narrative continuity,
            so you won't need to repeat the previous information, without mentioning it explicitly.
            Text to transform into the next part of the story:
            {text}
            """
            prompt = base_prompt + context_prompt
        else:
            prompt = base_prompt + f"\nText to transform into a story:\n{text}"

        try:
            logging.debug(f"Requesting summary from Ollama for text (len={len(text)})")
            response = self.client.generate(model=self.model, prompt=prompt)
            summary = response["response"] if response else "Summary unavailable."
            logging.debug("Summary received from Ollama")
            return summary
        except Exception as e:
            logging.error(f"Summary generation failed: {e}", exc_info=True)
            raise AudioProcessingError(f"Failed to generate summary: {e}")


class AudioPlayer:
    """Handles audio playback."""

    def __init__(self, file_manager: AudioFileManager):
        self.current_stream = None
        self.file_manager = file_manager
        self.is_playing = False
        self._stream_lock = threading.Lock()

    def play_audio(self, audio_file: Path):
        """Play audio file with proper resource management."""
        logging.debug(f"Starting playback for: {audio_file}")
        try:
            with sf.SoundFile(str(audio_file)) as f:
                with sd.OutputStream(
                        samplerate=f.samplerate,
                        channels=f.channels,
                        dtype=np.float32,
                        blocksize=1024
                ) as stream:
                    with self._stream_lock:
                        self.current_stream = stream
                        self.is_playing = True

                    while self.is_playing:
                        data = f.read(1024, dtype=np.float32)
                        if len(data) == 0:
                            break
                        stream.write(data)

            logging.debug(f"Finished playback for: {audio_file}")
            self.file_manager.cleanup_file(audio_file)
        except Exception as e:
            logging.error(f"Audio playback failed: {e}", exc_info=True)
            raise AudioProcessingError(f"Failed to play audio: {e}")
        finally:
            with self._stream_lock:
                self.is_playing = False
                self.current_stream = None

    def stop(self):
        """Stop current playback."""
        with self._stream_lock:
            self.is_playing = False
            if self.current_stream:
                logging.info("Stopping current audio stream")
                try:
                    time.sleep(0.1)
                    self.current_stream.stop()
                    self.current_stream.close()
                except Exception as e:
                    logging.warning(f"Error while stopping stream: {e}")
                finally:
                    self.current_stream = None


class Application:
    """Main application class."""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.shutdown_event = threading.Event()
        self.audio_queue = BoundedQueue(self.config.max_queue_size)
        self.playback_queue = BoundedQueue(self.config.max_queue_size)

        self.text_processor = TextProcessor(self.config)
        self.tts_engine = TTSEngine(self.config)
        self.ollama_client = OllamaClient(self.config)
        self.file_manager = AudioFileManager(self.config.audio_dir)
        self.audio_player = AudioPlayer(self.file_manager)

        self.processed_sections: Set[str] = set()
        self.processed_sentences: Set[str] = set()

        self.threads = []

    @staticmethod
    def _hash_section(section: str) -> str:
        """Generate a hash for a given section text."""
        return hashlib.sha256(section.encode('utf-8')).hexdigest()

    def process_section(self, last_section: str, section: str):
        """Process a single section of text."""
        section_hash = self._hash_section(section)
        if section_hash in self.processed_sections:
            logging.info("Section already processed, skipping.")
            return

        logging.debug(f"Processing section (length={len(section)}) with hash {section_hash}")
        try:
            summary = self.ollama_client.get_summary(last_section, section)
            sentences = self.text_processor.extract_sentences(summary)
            logging.debug(f"Generated summary sentences: {sentences}")

            for sentence in sentences:
                if self.shutdown_event.is_set():
                    logging.info("Shutdown event detected; stopping section processing")
                    break
                if sentence and sentence not in self.processed_sentences:
                    if self.audio_queue.put(sentence):
                        self.processed_sentences.add(sentence)
                        logging.debug(f"Enqueued new sentence for TTS: {sentence}")
                    else:
                        logging.warning(f"Could not enqueue sentence (queue full): {sentence}")
            self.processed_sections.add(section_hash)
        except Exception as e:
            logging.error(f"Section processing failed: {e}", exc_info=True)
            raise AudioProcessingError(f"Failed to process section: {e}")

    def rec_phrases(self):
        """Convert text to speech and add to playback queue."""
        logging.debug("rec_phrases thread started")
        while not self.shutdown_event.is_set():
            try:
                phrase = self.audio_queue.get()
                if phrase:
                    logging.debug(f"Converting phrase to speech: {phrase}")
                    with self.file_manager.temporary_audio_file() as temp_file:
                        self.tts_engine.generate_speech(phrase, temp_file)
                        audio_text_pair = AudioTextPair(text=phrase, audio_path=temp_file)
                        if self.playback_queue.put(audio_text_pair):
                            logging.debug(f"Enqueued audio-text pair for playback: {audio_text_pair}")
            except Exception as e:
                logging.error(f"Error in speech generation: {e}", exc_info=True)
                time.sleep(1)
        logging.debug("rec_phrases thread exiting")

    def play_phrases(self):
        """Play audio files from the playback queue and display corresponding text."""
        logging.debug("play_phrases thread started")
        while not self.shutdown_event.is_set():
            try:
                audio_text_pair = self.playback_queue.get()
                if audio_text_pair and audio_text_pair.audio_path.exists():
                    logging.debug(f"About to play audio file: {audio_text_pair.audio_path}")
                    logging.info(audio_text_pair.text)
                    self.audio_player.play_audio(audio_text_pair.audio_path)
            except Exception as e:
                logging.error(f"Error in audio playback: {e}", exc_info=True)
                time.sleep(1)
        logging.debug("play_phrases thread exiting")

    def create_worker_threads(self):
        """Create and start worker threads."""
        self.threads = [
            threading.Thread(target=self.rec_phrases, daemon=True, name="RecorderThread"),
            threading.Thread(target=self.play_phrases, daemon=True, name="PlayerThread")
        ]
        for thread in self.threads:
            thread.start()
            logging.info(f"Started thread: {thread.name}")

    def shutdown(self):
        """Gracefully shutdown the application."""
        logging.info("Initiating shutdown...")
        self.shutdown_event.set()
        self.audio_player.stop()

        for thread in self.threads:
            thread.join(timeout=self.config.thread_timeout)
            if thread.is_alive():
                logging.warning(f"Thread {thread.name} didn't shutdown gracefully")

        self.file_manager.cleanup()
        logging.info("Shutdown complete!")

    def run(self, file_path: str):
        """Main function to process and read the text."""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                full_text = file.read()

            sections = self.text_processor.split_into_sections(full_text)
            logging.info(f"Found {len(sections)} major sections")

            self.create_worker_threads()

            for i, section in enumerate(sections, 1):
                logging.debug(f"Processing section {i}/{len(sections)}")
                last_section = self.text_processor.destop_words(sections[i - 2]) if i > 1 else ""
                self.process_section(last_section, section)
                if i < len(sections):
                    time.sleep(1)

            while not self.audio_queue.empty() or not self.playback_queue.empty() or self.audio_player.is_playing:
                logging.debug("Waiting for audio processing to complete...")
                time.sleep(1)

        except KeyboardInterrupt:
            logging.info("Received keyboard interrupt...")
        except Exception as e:
            logging.error(f"An error occurred: {e}", exc_info=True)
        finally:
            self.shutdown()


if __name__ == '__main__':
    app = Application()
    app.run("text.txt")
