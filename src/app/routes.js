import { createBrowserRouter, Navigate, useParams } from "react-router";
import { createElement } from "react";
import { AdminLayout } from "./components/AdminLayout";
import { UserLayout } from "./components/UserLayout";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { YouthDatabase } from "./pages/admin/YouthDatabase";
import { NelpacOneCardAdmin } from "./pages/admin/NelpacOneCardAdmin";
import { EvaluationManagement } from "./pages/admin/EvaluationManagement";
import { ImageSubmissions } from "./pages/admin/ImageSubmissions";
import { UnifiedContentManagement } from "./pages/admin/UnifiedContentManagement";
import { RewardsManagement } from "./pages/admin/RewardsManagement";
import { Reports } from "./pages/admin/Reports";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { MerchPreordersManagement } from "./pages/admin/MerchPreordersManagement";
import { RegistrationAnalytics } from "./pages/admin/RegistrationAnalytics";
import { UnifiedFormsManagement } from "./pages/admin/UnifiedFormsManagement";
import { UserDashboard } from "./pages/user/UserDashboard";
import { UserProfile } from "./pages/user/UserProfile";
import { OneCardCenter } from "./pages/user/OneCardCenter";
import { UserCommunity } from "./pages/user/UserCommunity";
import { UserEvaluation } from "./pages/user/UserEvaluation";
import { UserGallery } from "./pages/user/UserGallery";
import { LocalChurchMembers } from "./pages/user/LocalChurchMembers";
import { UserSettings } from "./pages/user/UserSettings";
import { UserMerchPreorders } from "./pages/user/UserMerchPreorders";
import { UnifiedForms } from "./pages/user/UnifiedForms";
function LegacyEventFormRedirect() {
  const { eventId } = useParams();
  return createElement(Navigate, {
    to: `/user/forms?type=registration&event=${eventId}`,
    replace: true,
  });
}
function LegacyMerchFormRedirect() {
  const { formId } = useParams();
  return createElement(Navigate, {
    to: `/user/forms?type=merch&form=${formId}`,
    replace: true,
  });
}
function LegacyAdminPostsRedirect() {
  return createElement(Navigate, {
    to: "/admin/events?section=posts",
    replace: true,
  });
}
function LegacyUserPostsRedirect() {
  return createElement(Navigate, {
    to: "/user/events?section=posts",
    replace: true,
  });
}
function LegacySubmitImageRedirect() {
  return createElement(Navigate, {
    to: "/user/gallery?section=submit",
    replace: true,
  });
}
function LegacyRewardsRedirect() {
  return createElement(Navigate, {
    to: "/user/one-card?section=rewards",
    replace: true,
  });
}
const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  { path: "/register", Component: RegisterPage },
  { path: "/forgot-password", Component: ForgotPasswordPage },
  { path: "/reset-password", Component: ResetPasswordPage },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "youth-database", Component: YouthDatabase },
      { path: "one-card", Component: NelpacOneCardAdmin },
      { path: "events", Component: UnifiedContentManagement },
      { path: "forms", Component: UnifiedFormsManagement },
      { path: "merch-preorders", Component: MerchPreordersManagement },
      { path: "registrations", Component: RegistrationAnalytics },
      { path: "evaluations", Component: EvaluationManagement },
      { path: "image-submissions", Component: ImageSubmissions },
      { path: "posts", Component: LegacyAdminPostsRedirect },
      { path: "rewards", Component: RewardsManagement },
      { path: "reports", Component: Reports },
      { path: "settings", Component: AdminSettings },
    ],
  },
  {
    path: "/user",
    Component: UserLayout,
    children: [
      { index: true, Component: UserDashboard },
      { path: "profile", Component: UserProfile },
      { path: "one-card", Component: OneCardCenter },
      { path: "local-church-members", Component: LocalChurchMembers },
      { path: "events", Component: UserCommunity },
      { path: "forms", Component: UnifiedForms },
      { path: "events/:eventId/register", Component: LegacyEventFormRedirect },
      { path: "merch-preorders", Component: UserMerchPreorders },
      { path: "merch-preorders/:formId", Component: LegacyMerchFormRedirect },
      { path: "evaluations", Component: UserEvaluation },
      { path: "gallery", Component: UserGallery },
      { path: "submit-image", Component: LegacySubmitImageRedirect },
      { path: "posts", Component: LegacyUserPostsRedirect },
      { path: "rewards", Component: LegacyRewardsRedirect },
      { path: "settings", Component: UserSettings },
    ],
  },
]);
export { router };
