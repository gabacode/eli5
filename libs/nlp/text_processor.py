import logging
import re
from dataclasses import dataclass
from typing import List

import spacy

from config import Config
from libs.audio.audio_player import AudioProcessingError


@dataclass
class SectionInfo:
    section: str
    subjects: List[str]


class TextProcessor:
    """Handles text processing and section splitting."""

    def __init__(self, config: Config):
        self.config = config
        self.nlp = spacy.load('en_core_web_sm')

    def destop_words(self, text: str) -> str:
        """Remove stopwords from a list of tokens."""
        return ' '.join(token.text for token in self.nlp(text) if not token.is_stop)

    def split_into_sections(self, text: str, target_words: int = 250, min_section_length: int = 50) -> List[
        SectionInfo]:
        """
        Split text into meaningful sections based on paragraphs.
        @param text: The input text to split.
        @param target_words: The target number of words per section.
        @param min_section_length: The minimum number of words for a section.
        """
        if not text:
            logging.warning("Received empty text to split into sections")
            return []

        try:
            text = re.sub(r'\s+', ' ', text).strip()
            doc = self.nlp(text)

            sections_info = []
            current_section = []
            current_subjects = []
            current_word_count = 0

            for sent in doc.sents:
                sentence_words = len([token for token in sent if not token.is_space])
                subject = [tok for tok in sent if tok.dep_ == "nsubj"]
                current_subjects.append(" ".join([tok.text for tok in subject]))

                if current_word_count + sentence_words > target_words and current_section:
                    section_text = ' '.join(current_section).strip()
                    if section_text:
                        sections_info.append(SectionInfo(
                            section=section_text,
                            subjects=current_subjects
                        ))
                        logging.debug(f"Created section with {current_word_count} words")
                    current_section = []
                    current_subjects = []
                    current_word_count = 0

                current_section.append(sent.text)
                current_word_count += sentence_words

                if current_word_count > target_words * 1.5 and len(current_section) == 1:
                    section_text = ' '.join(current_section).strip()
                    if section_text:
                        sections_info.append(SectionInfo(
                            section=section_text,
                            subjects=current_subjects
                        ))
                        logging.debug(f"Created oversized section with {current_word_count} words")
                    current_section = []
                    current_subjects = []
                    current_word_count = 0

            if current_section:
                remaining_text = ' '.join(current_section).strip()
                if remaining_text:
                    if (current_word_count < min_section_length and sections_info
                            and len(sections_info[-1].section.split()) + current_word_count <= target_words * 1.2):
                        sections_info[-1].section += " " + remaining_text
                        sections_info[-1].subjects.extend(current_subjects)
                        logging.debug(f"Merged short final section with previous section")
                    else:
                        sections_info.append(SectionInfo(
                            section=remaining_text,
                            subjects=current_subjects
                        ))
                        logging.debug(f"Created final section with {current_word_count} words")

            if not sections_info:
                logging.warning("No sections were created from the input text")

            return sections_info

        except Exception as e:
            logging.error(f"Error in split_into_sections: {e}", exc_info=True)
            raise AudioProcessingError(f"Failed to split text into sections: {e}")

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
