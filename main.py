import hashlib
import logging
import threading
import time
from typing import Set

from config import Config, AudioTextPair
from libs.audio import AudioPlayer, AudioProcessingError, TTSEngine
from libs.file_handlers import BoundedQueue, AudioFileManager
from libs.nlp import OllamaClient, TextProcessor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)


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
                    # Display text and play audio
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
