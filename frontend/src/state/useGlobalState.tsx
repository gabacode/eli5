import { createContext, useContext, useReducer, ReactNode } from "react";
import { Status, Message } from "../utils/types";

type State = {
  status: Status;
  messages: Message[];
  messageIdx: number;
  isPlaying: boolean;
  audioQueue: ArrayBuffer[];
};

type StateAction =
  | { type: "SET_STATUS"; status: Status }
  | { type: "SET_MESSAGES"; messages: Message[] }
  | { type: "SET_AUDIO_QUEUE"; queue: ArrayBuffer[] }
  | { type: "ADD_TO_AUDIO_QUEUE"; audio: ArrayBuffer }
  | { type: "REMOVE_FIRST_AUDIO" }
  | { type: "MARK_PLAYED"; index: number }
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "SET_MSG_IDX"; index: number }
  | { type: "SET_IS_PLAYING"; isPlaying: boolean };

const initialState: State = {
  status: "idle" as Status,
  messages: [],
  messageIdx: 0,
  isPlaying: false,
  audioQueue: [],
};

const reducer = (state: State, action: StateAction): State => {
  switch (action.type) {
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "SET_MESSAGES":
      return { ...state, messages: action.messages };
    case "SET_AUDIO_QUEUE":
      return { ...state, audioQueue: action.queue };
    case "ADD_TO_AUDIO_QUEUE":
      return { ...state, audioQueue: [...state.audioQueue, action.audio] };
    case "REMOVE_FIRST_AUDIO":
      return { ...state, audioQueue: state.audioQueue.slice(1) };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "MARK_PLAYED":
      return {
        ...state,
        messages: state.messages.map((msg, idx) =>
          idx === action.index ? { ...msg, played: true } : msg
        ),
      };
    case "SET_MSG_IDX":
      return { ...state, messageIdx: action.index };
    case "SET_IS_PLAYING":
      return { ...state, isPlaying: action.isPlaying };
    default:
      return state;
  }
};

const GlobalStateContext = createContext<{
  state: State;
  dispatch: React.Dispatch<StateAction>;
} | null>(null);

export const GlobalStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <GlobalStateContext.Provider value={{ state, dispatch }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error("useGlobalState must be used within a GlobalStateProvider");
  }
  return context;
};
