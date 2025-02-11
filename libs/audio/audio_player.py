import logging
import threading
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf

from libs.file_handlers.file_manager import AudioFileManager


class AudioProcessingError(Exception):
    """Custom exception for audio processing errors."""
    pass


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
