import asyncio
import base64
import json
import logging
import threading
from pathlib import Path
from queue import Empty
from typing import Dict

import websockets

from main import Application, Config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s'
)


class TTSTransmitter:
    """Handles the transmission of TTS data over WebSocket."""

    def __init__(self, websocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.shutdown_flag = threading.Event()
        self.app = None

    def start_tts_app(self):
        """Initialize and start the TTS application."""
        config = Config(
            audio_dir=Path(f"audio_cache_{self.session_id}"),
            thread_timeout=10
        )
        self.app = Application(config)
        # Only start the recording thread, not the playback thread
        self.app.create_rec_thread()

    async def transmit_audio(self, audio_text_pair):
        """Transmit a single audio-text pair over WebSocket."""
        try:
            # Send text first
            await self.websocket.send(json.dumps({
                'type': 'text',
                'content': audio_text_pair.text
            }))

            # Read and send audio data
            with open(audio_text_pair.audio_path, 'rb') as f:
                audio_data = f.read()
                await self.websocket.send(json.dumps({
                    'type': 'audio',
                    'content': base64.b64encode(audio_data).decode('utf-8')
                }))

            # Cleanup the audio file
            self.app.file_manager.cleanup_file(audio_text_pair.audio_path)

        except Exception as e:
            logging.error(f"Error transmitting audio: {e}")

    def monitor_queue(self, event_loop):
        """Monitor the playback queue and schedule transmissions."""
        while not self.shutdown_flag.is_set():
            try:
                # Try to get an item from the queue
                audio_text_pair = self.app.playback_queue.get(timeout=0.5)

                if audio_text_pair and audio_text_pair.audio_path.exists():
                    # Schedule the transmission in the event loop
                    asyncio.run_coroutine_threadsafe(
                        self.transmit_audio(audio_text_pair),
                        event_loop
                    )
            except Empty:
                continue
            except Exception as e:
                logging.error(f"Error in queue monitoring: {e}")
                continue

    def process_text(self, content: str):
        """Process the text content."""
        try:
            sections = self.app.text_processor.split_into_sections(content)
            logging.info(f"Found {len(sections)} sections")

            for i, section in enumerate(sections, 1):
                if self.shutdown_flag.is_set():
                    break
                last_section = self.app.text_processor.destop_words(sections[i - 2]) if i > 1 else ""
                self.app.process_section(last_section, section)

        except Exception as e:
            logging.error(f"Error processing text: {e}")

    def shutdown(self):
        """Shutdown the transmitter and cleanup resources."""
        self.shutdown_flag.set()
        if self.app:
            self.app.shutdown()


class TTSServer:
    """WebSocket server for TTS service."""

    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.transmitters: Dict[str, TTSTransmitter] = {}

    async def handle_upload(self, websocket, content: str, session_id: str):
        """Handle text upload and start processing."""
        try:
            # Create and setup transmitter
            transmitter = TTSTransmitter(websocket, session_id)
            self.transmitters[session_id] = transmitter

            # Start TTS application
            transmitter.start_tts_app()

            # Start queue monitoring in a separate thread
            monitor_thread = threading.Thread(
                target=transmitter.monitor_queue,
                args=(asyncio.get_event_loop(),),
                daemon=True,
                name=f"QueueMonitor-{session_id}"
            )
            monitor_thread.start()

            # Process the text in a separate thread
            process_thread = threading.Thread(
                target=transmitter.process_text,
                args=(content,),
                daemon=True,
                name=f"TextProcessor-{session_id}"
            )
            process_thread.start()

        except Exception as e:
            logging.error(f"Error handling upload: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'content': str(e)
            }))

    async def cleanup_session(self, session_id: str):
        """Cleanup session resources."""
        if session_id in self.transmitters:
            transmitter = self.transmitters[session_id]
            transmitter.shutdown()
            del self.transmitters[session_id]

            # Cleanup cache directory
            cache_dir = Path(f"audio_cache_{session_id}")
            if cache_dir.exists():
                for file in cache_dir.glob("*"):
                    file.unlink()
                cache_dir.rmdir()

    async def handle_connection(self, websocket):
        """Handle incoming WebSocket connection."""
        session_id = str(hash(websocket))
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    if 'content' in data:
                        await self.handle_upload(websocket, data['content'], session_id)
                except json.JSONDecodeError:
                    logging.error("Invalid JSON received")

        except websockets.exceptions.ConnectionClosed:
            logging.info(f"Client disconnected: {session_id}")
        finally:
            await self.cleanup_session(session_id)

    async def start(self):
        """Start the WebSocket server."""
        async with websockets.serve(self.handle_connection, self.host, self.port):
            logging.info(f"TTS Server running at ws://{self.host}:{self.port}")
            await asyncio.Future()  # run forever


if __name__ == "__main__":
    server = TTSServer()
    asyncio.run(server.start())
