import { AuthPageController } from "./src/controllers/auth-page-controller.js";
import { authService } from "./src/services/auth-service.js";
import { AuthView } from "./src/views/auth-view.js";
import { setupPasswordToggles } from "./Assets/js/password-toggle.js";

setupPasswordToggles();
new AuthPageController(authService, new AuthView()).initialize();
