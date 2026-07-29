import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { FloorMapPage } from "./pages/FloorMapPage";
import { HomePage } from "./pages/HomePage";
import { CampusPage } from "./pages/CampusPage";
import { MiddleSegmentPage } from "./pages/MiddleSegmentPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { FloorEditorPage } from "./pages/admin/FloorEditorPage";
import { LoginPage } from "./pages/admin/LoginPage";
import { PresetsPage } from "./pages/admin/PresetsPage";
import { StructurePage } from "./pages/admin/StructurePage";
import { UsersPage } from "./pages/admin/UsersPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin routes MUST be registered before /:campusSlug to avoid collision */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<StructurePage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="presets" element={<PresetsPage />} />
          <Route path="floors/:floorId" element={<FloorEditorPage />} />
        </Route>

        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path=":campusSlug" element={<CampusPage />} />
          <Route path=":campusSlug/:segmentSlug" element={<MiddleSegmentPage />} />
          <Route
            path=":campusSlug/:buildingSlug/:floorSlug"
            element={<FloorMapPage />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
