import logging
import os
import re
import threading
import time
from collections import deque

import sounddevice as sd
import soundfile as sf
import spacy
import torch
from TTS.api import TTS
from ollama import Client

original_load = torch.load
torch.load = lambda *args, **kwargs: original_load(*args, **kwargs, weights_only=False)

logging.basicConfig(level=logging.INFO)


class Application:
    def __init__(self):
        self.shutdown_event = threading.Event()
        self.nlp = spacy.load('en_core_web_sm')
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True).to("cuda")
        self.audio_dir = "audio_cache"
        self.client = Client(
            host='http://localhost:11434',
            headers={'x-some-header': 'some-value'}
        )
        self.audio_queue = deque()
        self.playback_queue = deque()
        self.startup()

    def startup(self):
        logging.info("Starting up...")
        os.makedirs(self.audio_dir, exist_ok=True)

    def get_detailed_summary(self, text, model):
        """Get an engaging, storytelling summary from Ollama."""
        prompt = f"""
        Imagine you're explaining this content to an interested friend who's smart but not an expert in the field. Create an engaging summary that:

        1. Sets the scene and introduces the main ideas like you're telling a story
        2. Explains key concepts using relatable analogies or examples where appropriate
        3. Connects different parts of the content in a natural, flowing way
        4. Highlights the most interesting or surprising elements
        5. Wraps up by emphasizing why this matters or what we learned

        Keep the tone conversational but informative, like an engaging podcast or documentary. Aim for about 200-300 words.

        Text to transform into a story:
        {text}
        """

        try:
            response = self.client.generate(model=model, prompt=prompt)
            if response:
                return response["response"]
            else:
                return "Summary unavailable for this section."
        except Exception as e:
            print(f"Error getting summary: {e}")
            return "Summary generation failed for this section."

    @staticmethod
    def split_into_meaningful_sections(text):
        """Split text into meaningful sections based on content and length."""
        section_markers = [
            r'\n\n(?=[A-Z][^.!?]{50,})',
            r'\n===+\n',
            r'\n\*\*\*+\n',
            r'\n---+\n',
            r'\n\n(?=[IVX]+\.)',
        ]

        pattern = '|'.join(section_markers)
        sections = re.split(pattern, text)

        MIN_SECTION_LENGTH = 2000
        cleaned_sections = []
        current_section = ""

        for section in sections:
            section = section.strip()
            current_section += "\n\n" + section if current_section else section

            if len(current_section) >= MIN_SECTION_LENGTH:
                cleaned_sections.append(current_section)
                current_section = ""

        if current_section and len(current_section) > 500:
            cleaned_sections.append(current_section)

        return cleaned_sections

    def extract_sentences(self, text):
        """Extract complete sentences from text."""
        doc = self.nlp(text)
        return [sent.text.strip() for sent in doc.sents]

    def play_phrases(self):
        """Play audio files from the playback queue."""
        while not self.shutdown_event.is_set():
            if self.playback_queue:
                audio_file = self.playback_queue.popleft()
                try:
                    audio, samplerate = sf.read(audio_file)
                    sd.play(audio, samplerate=samplerate)
                    sd.wait()
                    os.remove(audio_file)
                except Exception as e:
                    print(f"Error playing audio: {e}")
            else:
                time.sleep(0.1)

    def rec_phrases(self):
        """Convert text to speech and add to playback queue."""
        while not self.shutdown_event.is_set():
            if self.audio_queue:
                phrase = self.audio_queue.popleft()
                try:
                    file_path = os.path.join(self.audio_dir, f"{time.time()}.wav")
                    self.tts.tts_to_file(
                        text=phrase,
                        speaker_wav="voice.wav",
                        language="en",
                        file_path=file_path
                    )
                    self.playback_queue.append(file_path)
                except Exception as e:
                    print(f"Error generating speech: {e}")
            else:
                time.sleep(0.1)

    def process_section(self, section, model):
        """Process a single section's content."""
        summary = self.get_detailed_summary(section, model)
        sentences = self.extract_sentences(summary)
        for sentence in sentences:
            if sentence and not self.shutdown_event.is_set():
                self.audio_queue.append(sentence)

    def run(self, file_path, model):
        """Main function to process and read the text."""
        rec_thread = None
        playback_thread = None

        try:
            # Read the entire file
            with open(file_path, 'r', encoding='utf-8') as file:
                full_text = file.read()

            # Split into meaningful sections
            sections = self.split_into_meaningful_sections(full_text)
            print(f"Found {len(sections)} major sections")

            # Start worker threads
            rec_thread = threading.Thread(target=self.rec_phrases)
            rec_thread.daemon = True
            rec_thread.start()

            playback_thread = threading.Thread(target=self.play_phrases)
            playback_thread.daemon = True
            playback_thread.start()

            # Process each section
            for i, section in enumerate(sections, 1):
                print(f"Processing section {i}/{len(sections)}")
                self.process_section(section, model)

                # Add transition between sections
                if i < len(sections):
                    time.sleep(1)

            # Wait for queues to be empty
            while self.audio_queue or self.playback_queue:
                time.sleep(1)

        except KeyboardInterrupt:
            print("\nStopping gracefully...")
        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            # Signal threads to stop
            self.shutdown_event.set()

            # Wait for threads to finish
            print("Waiting for worker threads to finish...")
            if rec_thread:
                rec_thread.join(timeout=5)
            if playback_thread:
                playback_thread.join(timeout=5)

            # Stop any ongoing audio playback
            sd.stop()

            # Cleanup audio files
            print("Cleaning up audio files...")
            for file in os.listdir(self.audio_dir):
                try:
                    os.remove(os.path.join(self.audio_dir, file))
                except Exception as e:
                    print(f"Error removing file: {e}")

            print("Shutdown complete!")


if __name__ == '__main__':
    app = Application()
    app.run("text.txt", model="gemma2:latest")
