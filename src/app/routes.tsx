import { createBrowserRouter } from "react-router";
import { HomePage } from "./pages/HomePage";
import { NoteDetailPage } from "./pages/NoteDetailPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
  },
  {
    path: "/note/:noteId",
    Component: NoteDetailPage,
  },
]);