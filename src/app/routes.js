import { createBrowserRouter } from "react-router";
import { AdminLayout } from "./components/AdminLayout";
import { UserLayout } from "./components/UserLayout";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { YouthDatabase } from "./pages/admin/YouthDatabase";
import { NelpacOneCardAdmin } from "./pages/admin/NelpacOneCardAdmin";
import { EventsManagement } from "./pages/admin/EventsManagement";
import { EvaluationManagement } from "./pages/admin/EvaluationManagement";
import { ImageSubmissions } from "./pages/admin/ImageSubmissions";
import { PostsManagement } from "./pages/admin/PostsManagement";
import { RewardsManagement } from "./pages/admin/RewardsManagement";
import { Reports } from "./pages/admin/Reports";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { UserDashboard } from "./pages/user/UserDashboard";
import { UserProfile } from "./pages/user/UserProfile";
import { UserOneCard } from "./pages/user/UserOneCard";
import { UserEvents } from "./pages/user/UserEvents";
import { UserEvaluation } from "./pages/user/UserEvaluation";
import { ImageGallery } from "./pages/user/ImageGallery";
import { SubmitImage } from "./pages/user/SubmitImage";
import { UserPosts } from "./pages/user/UserPosts";
import { UserRewards } from "./pages/user/UserRewards";
import { LocalChurchMembers } from "./pages/user/LocalChurchMembers";
import { UserSettings } from "./pages/user/UserSettings";
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
      { path: "events", Component: EventsManagement },
      { path: "evaluations", Component: EvaluationManagement },
      { path: "image-submissions", Component: ImageSubmissions },
      { path: "posts", Component: PostsManagement },
      { path: "rewards", Component: RewardsManagement },
      { path: "reports", Component: Reports },
      { path: "settings", Component: AdminSettings }
    ]
  },
  {
    path: "/user",
    Component: UserLayout,
    children: [
      { index: true, Component: UserDashboard },
      { path: "profile", Component: UserProfile },
      { path: "one-card", Component: UserOneCard },
      { path: "local-church-members", Component: LocalChurchMembers },
      { path: "events", Component: UserEvents },
      { path: "evaluations", Component: UserEvaluation },
      { path: "gallery", Component: ImageGallery },
      { path: "submit-image", Component: SubmitImage },
      { path: "posts", Component: UserPosts },
      { path: "rewards", Component: UserRewards },
      { path: "settings", Component: UserSettings }
    ]
  }
]);
export {
  router
};
