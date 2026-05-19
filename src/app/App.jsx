import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./lib/authContext";
function App() {
  return <AuthProvider><RouterProvider router={router} /></AuthProvider>;
}
export {
  App as default
};
