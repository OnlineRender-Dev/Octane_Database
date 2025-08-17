// Add "is-ready" so CSS entrance animations can run
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("is-ready");

  // Wire up buttons (replace with real navigation when ready)
  const educator = document.getElementById("educatorBtn");
  const student = document.getElementById("studentBtn");

  educator?.addEventListener("click", () => {
    console.log("Educator selected");
    // TODO: window.location.href = "/educator.html";
  });

  student?.addEventListener("click", () => {
    console.log("Student selected");
    // TODO: window.location.href = "/student.html";
  });
});
