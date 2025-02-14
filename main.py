import gc
import hashlib
import threading
import time
from typing import Set, List

import torch

from config import Config, AudioTextPair
from libs.audio import AudioPlayer, AudioProcessingError, TTSEngine
from libs.file_handlers import BoundedQueue, AudioFileManager
from libs.nlp import OllamaClient, TextProcessor
from libs.nlp.text_processor import SectionInfo
from libs.utils.logger import Logger

logger = Logger()


class Application:
    """Main application class."""

    def __init__(self, config: Config = Config()):
        self.config = config
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
            logger.info("Section already processed, skipping.")
            return

        logger.debug(f"Processing section (length={len(section)}) with hash {section_hash}")
        try:
            summary = self.ollama_client.get_summary(last_section, section)
            sentences = self.text_processor.extract_sentences(summary)
            logger.debug(f"Generated summary sentences: {sentences}")

            for sentence in sentences:
                if self.shutdown_event.is_set():
                    logger.info("Shutdown event detected; stopping section processing")
                    break
                if sentence and sentence not in self.processed_sentences:
                    if self.audio_queue.put(sentence):
                        self.processed_sentences.add(sentence)
                        logger.debug(f"Enqueued new sentence for TTS: {sentence}")
                    else:
                        logger.warning(f"Could not enqueue sentence (queue full): {sentence}")
            self.processed_sections.add(section_hash)
        except Exception as e:
            logger.error(f"Section processing failed: {e}")
            raise AudioProcessingError(f"Failed to process section: {e}")

    def rec_phrases(self):
        """Convert text to speech and add to playback queue."""
        logger.debug("rec_phrases thread started")
        while not self.shutdown_event.is_set():
            try:
                phrase = self.audio_queue.get()
                if phrase:
                    logger.debug(f"Converting phrase to speech: {phrase}")
                    with self.file_manager.temporary_audio_file() as temp_file:
                        self.tts_engine.generate_speech(phrase, temp_file)
                        audio_text_pair = AudioTextPair(text=phrase, audio_path=temp_file)
                        if self.playback_queue.put(audio_text_pair):
                            logger.debug(f"Enqueued audio-text pair for playback: {audio_text_pair}")
            except Exception as e:
                logger.error(f"Error in speech generation: {e}")
                time.sleep(1)
        logger.debug("rec_phrases thread exiting")

    def play_phrases(self):
        """Play audio files from the playback queue and display corresponding text."""
        logger.debug("play_phrases thread started")
        while not self.shutdown_event.is_set():
            try:
                audio_text_pair = self.playback_queue.get()
                if audio_text_pair and audio_text_pair.audio_path.exists():
                    logger.debug(f"About to play audio file: {audio_text_pair.audio_path}")
                    # Display text and play audio
                    logger.info(audio_text_pair.text)
                    self.audio_player.play_audio(audio_text_pair.audio_path)
            except Exception as e:
                logger.error(f"Error in audio playback: {e}")
                time.sleep(1)
        logger.debug("play_phrases thread exiting")

    def create_rec_thread(self):
        threading.Thread(target=self.rec_phrases, daemon=True, name="RecorderThread").start()

    def create_play_thread(self):
        threading.Thread(target=self.play_phrases, daemon=True, name="PlayerThread").start()

    @staticmethod
    def empty_cache():
        if torch.cuda.is_available():
            logger.info("Emptying CUDA cache")
            torch.cuda.empty_cache()
            gc.collect()

    def shutdown(self):
        """Gracefully shutdown the application."""
        logger.info("Initiating shutdown...")
        self.shutdown_event.set()
        self.audio_player.stop()

        for thread in self.threads:
            thread.join(timeout=self.config.thread_timeout)
            if thread.is_alive():
                logger.warning(f"Thread {thread.name} didn't shutdown gracefully")

        self.file_manager.cleanup()
        logger.info("Shutdown complete!")

    def run(self, file_path: str):
        """Main function to process and read the text."""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                full_text = file.read()

            sections_info: List[SectionInfo] = self.text_processor.split_into_sections(full_text)
            logger.info(f"Found {len(sections_info)} major sections")

            self.create_rec_thread()
            self.create_play_thread()

            for i, section_info in enumerate(sections_info, 1):
                section_text = section_info.section
                subjects = section_info.subjects
                logger.info(f"Processing section {i}/{len(sections_info)}")
                logger.info(f"Subjects: {subjects}")
                last_section = self.text_processor.destop_words(sections_info[i - 2].section) if i > 1 else ""
                self.process_section(last_section, section_text)

                if i < len(sections_info):
                    time.sleep(1)

            while not self.audio_queue.empty() or not self.playback_queue.empty() or self.audio_player.is_playing:
                logger.debug("Waiting for audio processing to complete...")
                time.sleep(1)

        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt...")
        except Exception as e:
            logger.error(f"An error occurred: {e}")
        finally:
            self.shutdown()


if __name__ == '__main__':
    app = Application()
    app.run("text.txt")
