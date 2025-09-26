import speech_recognition as sr

class AudioInput:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # Custom crypto vocabulary correction mapping
        self.corrections = {
            "unicef": "uniswap",
            "you n swap": "uniswap",
            "uni swap": "uniswap",
            "a wave": "aave",
            "a way":"aave",
            "pyth": "pyth network",
            "flow":" flow blockchain",
            "hedera":"hedera EVM",
            "sol":"solana",
            "1 inch": "1inch",
            "one inch": "1inch",
            "curve fi": "curve finance",
            "root sock":"rootstock",
            "poly agon": "polygon",
            "poly gan": "polygon",
            "poly gone": "polygon",
            "matic":"polygon",
            "avalanche":"avalanche",
            "ava lanche":"avalanche",
            "ava lanch":"avalanche",
            "a lanch": "avalanche",
            "file con":"filecoin",
            "file coin":"filecoin",
            "file con":"filecoin",
            "the grpaph": "the graph",
            "the graph":"the graph",
            "graph":"the graph",
            "wal rus":"walrus",
            "walrus":"walrus",
            "ave": "aave",
            "lidoh": "lido",
            "curb finance": "curve finance",
            "make a dao": "makerdao",
            "sushiswap": "sushi swap"
        }

    def apply_corrections(self, text: str) -> str:
        if not text:
            return text
        for wrong, correct in self.corrections.items():
            if wrong in text.lower():
                text = text.lower().replace(wrong, correct)
        return text

    def listen_for_wake_word(self, wake_words=["hey pluto", "hepluto"], timeout=None):
        print(f"Say 'Hey Pluto' to start...")
        while True:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source)
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=3)
            try:
                text = self.recognizer.recognize_google(audio).lower()
                text = self.apply_corrections(text)
                print(f"Heard: {text}")
                for word in wake_words:
                    if word in text:
                        print("Wake word detected!")
                        return True
            except sr.UnknownValueError:
                continue
            except Exception as e:
                print(f"Wake word error: {e}")
                continue

    def listen_until_silence(self, max_silence=3, max_duration=20):
        print("Listening for speech...")
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source)
            audio = self.recognizer.listen(source, timeout=None, phrase_time_limit=max_duration)
        return audio

    def listen(self, phrase_time_limit=10):
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source)
            print("Listening...")
            audio = self.recognizer.listen(source, phrase_time_limit=phrase_time_limit)
        return audio

    def transcribe(self, audio):
        try:
            text = self.recognizer.recognize_google(audio)
            text = self.apply_corrections(text)
            return text
        except sr.UnknownValueError:
            return None
        except Exception as e:
            print(f"AudioInput error: {e}")
            return None
