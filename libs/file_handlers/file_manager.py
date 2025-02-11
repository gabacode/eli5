import logging
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Set


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
