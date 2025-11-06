document.addEventListener("DOMContentLoaded", () => {
  const toggleMenu = document.getElementById("toggle-menu");
  const sidebar = document.getElementById("sidebar");

  toggleMenu.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

  const submenus = document.querySelectorAll(".has-submenu");

  submenus.forEach(menu => {
    const link = menu.querySelector("a");
    const submenu = menu.querySelector(".submenu");

    link.addEventListener("click", (e) => {
      e.preventDefault();

      submenus.forEach(m => {
        if (m !== menu) {
          m.classList.remove("open");
          m.querySelector(".submenu").classList.remove("open");
        }
      });

      menu.classList.toggle("open");
      submenu.classList.toggle("open");
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const userDropdown = document.getElementById("userDropdown");
  const userMenu = document.getElementById("userMenu");
  const userContainer = document.querySelector(".user-menu");

  userDropdown.addEventListener("click", () => {
    userContainer.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!userContainer.contains(e.target)) {
      userContainer.classList.remove("open");
    }
  });
});


