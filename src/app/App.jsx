import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./lib/authContext";
import { applyThemePreference, getThemePreference } from "./lib/themePreference";

function App() {
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    applyThemePreference(getThemePreference());
    setThemeReady(true);
  }, []);

  if (!themeReady) return null;

  return <AuthProvider><RouterProvider router={router} /></AuthProvider>;
}
export {
  App as default
};
