import io
import logging
from contextlib import redirect_stdout
from pathlib import Path

import torch
from TTS.api import TTS

from config import Config
from libs.audio.audio_player import AudioProcessingError


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
