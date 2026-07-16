import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { BuildingPage } from "./pages/BuildingPage";
import { CampusPage } from "./pages/CampusPage";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path=":campusSlug" element={<CampusPage />} />
          <Route path=":campusSlug/:buildingSlug" element={<BuildingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
