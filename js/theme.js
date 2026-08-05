const themeButton = document.querySelector("#theme-button");

const savedTheme = localStorage.getItem("urbanThreadsTheme");

const systemPrefersDark = window.matchMedia(
  "(prefers-color-scheme: dark)"
).matches;

const initialTheme =
  savedTheme || (systemPrefersDark ? "dark" : "light");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (!themeButton) {
    return;
  }

  if (theme === "dark") {
    themeButton.textContent = "☀";
    themeButton.setAttribute(
      "aria-label",
      "Switch to light mode"
    );
  } else {
    themeButton.textContent = "☾";
    themeButton.setAttribute(
      "aria-label",
      "Switch to dark mode"
    );
  }
}

applyTheme(initialTheme);

themeButton?.addEventListener("click", () => {
  const currentTheme =
    document.documentElement.dataset.theme;

  const newTheme =
    currentTheme === "dark" ? "light" : "dark";

  applyTheme(newTheme);

  localStorage.setItem(
    "urbanThreadsTheme",
    newTheme
  );
});