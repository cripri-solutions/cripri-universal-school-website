/* CRIPRI Universal School Website
   CUSTOMISE THIS OBJECT for each school's public website.
   Keep private credentials and student information out of this file. */
const SCHOOL_SETTINGS = {
  name: "Your School",
  tagline: "Welcome to a school community where every learner matters.",
  email: "info@example.com",
  phone: "+000 000 000 000",
  location: "School location"
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-school-name]").forEach((element) => {
    element.textContent = SCHOOL_SETTINGS.name;
  });

  document.querySelectorAll("[data-school-tagline]").forEach((element) => {
    element.textContent = SCHOOL_SETTINGS.tagline;
  });

  document.querySelectorAll("[data-school-email]").forEach((element) => {
    element.textContent = SCHOOL_SETTINGS.email;
  });
  document.querySelectorAll("[data-school-email-link]").forEach((element) => {
    element.href = "mailto:" + SCHOOL_SETTINGS.email;
  });

  document.querySelectorAll("[data-school-phone]").forEach((element) => {
    element.textContent = SCHOOL_SETTINGS.phone;
  });
  document.querySelectorAll("[data-school-phone-link]").forEach((element) => {
    element.href = "tel:" + SCHOOL_SETTINGS.phone.replace(/[^+\d]/g, "");
  });

  document.querySelectorAll("[data-school-location]").forEach((element) => {
    element.textContent = SCHOOL_SETTINGS.location;
  });

  document.title = SCHOOL_SETTINGS.name + " | Welcome";
  const year = document.getElementById("current-year");
  if (year) year.textContent = new Date().getFullYear();

  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector("#site-nav");
  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const isOpen = navigation.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });
    navigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigation.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }
});