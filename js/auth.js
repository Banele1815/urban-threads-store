import { auth, db } from "./firebase-config.js";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
  doc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const loginTab = document.querySelector("#login-tab");
const signupTab = document.querySelector("#signup-tab");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const authMessage = document.querySelector("#auth-message");
const forgotPasswordButton =
  document.querySelector("#forgot-password-button");

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Could not set authentication persistence:", error);
});

function showMessage(message, type = "error") {
  authMessage.textContent = message;
  authMessage.className = `auth-message ${type}`;
}

function clearMessage() {
  authMessage.textContent = "";
  authMessage.className = "auth-message hidden";
}

function selectAuthForm(formName) {
  clearMessage();

  const showingLogin = formName === "login";

  loginForm.classList.toggle("hidden", !showingLogin);
  signupForm.classList.toggle("hidden", showingLogin);

  loginTab.classList.toggle("active", showingLogin);
  signupTab.classList.toggle("active", !showingLogin);

  loginTab.setAttribute(
    "aria-selected",
    String(showingLogin)
  );

  signupTab.setAttribute(
    "aria-selected",
    String(!showingLogin)
  );

  if (showingLogin) {
    document.querySelector("#login-email").focus();
  } else {
    document.querySelector("#signup-name").focus();
  }
}

function getFriendlyAuthError(error) {
  const errorMessages = {
    "auth/email-already-in-use":
      "An account already exists with this email address.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Your password does not meet the security requirements.",

    "auth/invalid-credential":
      "The email address or password is incorrect.",

    "auth/user-not-found":
      "The email address or password is incorrect.",

    "auth/wrong-password":
      "The email address or password is incorrect.",

    "auth/too-many-requests":
      "Too many attempts were made. Please wait before trying again.",

    "auth/network-request-failed":
      "A network error occurred. Check your connection and try again."
  };

  return (
    errorMessages[error.code] ||
    "Something went wrong. Please try again."
  );
}

function passwordIsStrong(password) {
  const hasMinimumLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return (
    hasMinimumLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber
  );
}

function setButtonLoading(button, isLoading, loadingText) {
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;

    button.disabled = false;
  }
}

loginTab.addEventListener("click", () => {
  selectAuthForm("login");
});

signupTab.addEventListener("click", () => {
  selectAuthForm("signup");
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const submitButton =
    signupForm.querySelector('button[type="submit"]');

  const name =
    document.querySelector("#signup-name").value.trim();

  const email =
    document
      .querySelector("#signup-email")
      .value
      .trim()
      .toLowerCase();

  const password =
    document.querySelector("#signup-password").value;

  const confirmedPassword =
    document.querySelector("#confirm-password").value;

  const acceptedTerms =
    document.querySelector("#terms-checkbox").checked;

  if (name.length < 2) {
    showMessage("Please enter your full name.");
    return;
  }

  if (!email) {
    showMessage("Please enter your email address.");
    return;
  }

  if (!passwordIsStrong(password)) {
    showMessage(
      "Your password must contain at least 8 characters, an uppercase letter, a lowercase letter and a number."
    );

    return;
  }

  if (password !== confirmedPassword) {
    showMessage("The two passwords do not match.");
    return;
  }

  if (!acceptedTerms) {
    showMessage(
      "Please agree to the terms before creating your account."
    );

    return;
  }

  setButtonLoading(
    submitButton,
    true,
    "Creating account..."
  );

  try {
    const userCredential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    await updateProfile(userCredential.user, {
      displayName: name
    });

    await setDoc(
      doc(db, "users", userCredential.user.uid),
      {
        displayName: name,
        email,
        createdAt: serverTimestamp()
      }
    );

    signupForm.reset();

    showMessage(
      `Welcome, ${name}! Your account was created successfully.`,
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "./shop.html";
    }, 1200);
  } catch (error) {
    console.error("Signup failed:", error);
    showMessage(getFriendlyAuthError(error));
  } finally {
    setButtonLoading(submitButton, false);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const submitButton =
    loginForm.querySelector('button[type="submit"]');

  const email =
    document
      .querySelector("#login-email")
      .value
      .trim()
      .toLowerCase();

  const password =
    document.querySelector("#login-password").value;

  if (!email || !password) {
    showMessage(
      "Please enter both your email address and password."
    );

    return;
  }

  setButtonLoading(submitButton, true, "Logging in...");

  try {
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    loginForm.reset();

    showMessage(
      "Login successful. Redirecting to the shop...",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "./shop.html";
    }, 900);
  } catch (error) {
    console.error("Login failed:", error);
    showMessage(getFriendlyAuthError(error));
  } finally {
    setButtonLoading(submitButton, false);
  }
});

forgotPasswordButton.addEventListener(
  "click",
  async () => {
    clearMessage();

    const email =
      document
        .querySelector("#login-email")
        .value
        .trim()
        .toLowerCase();

    if (!email) {
      showMessage(
        "Enter your email address first, then select Forgot your password."
      );

      return;
    }

    forgotPasswordButton.disabled = true;
    forgotPasswordButton.textContent = "Sending...";

    try {
      await sendPasswordResetEmail(auth, email);

      showMessage(
        "If an account uses that email, a password-reset message has been sent.",
        "success"
      );
    } catch (error) {
      console.error("Password reset failed:", error);

      if (error.code === "auth/invalid-email") {
        showMessage("Please enter a valid email address.");
      } else {
        showMessage(
          "We could not send the password-reset email. Please try again."
        );
      }
    } finally {
      forgotPasswordButton.disabled = false;
      forgotPasswordButton.textContent =
        "Forgot your password?";
    }
  }
);