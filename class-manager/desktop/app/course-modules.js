/* CM Settings controls for the current course's enabled modules. */
(function () {
  "use strict";
  const form = document.getElementById("course-modules");
  const choices = document.getElementById("course-module-choices");
  const status = document.getElementById("course-module-status");
  const button = form.querySelector("button");

  function render(state) {
    if (!state.ok) { status.textContent = state.why; return; }
    const labels = new Map(state.choices.map(choice => [choice.id, choice.label]));
    choices.replaceChildren();
    for (const choice of state.choices) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = choice.id;
      checkbox.checked = state.enabled.includes(choice.id);
      const requirement = choice.requires.length ? " (requires " + choice.requires.map(id => labels.get(id)).join(", ") + ")" : "";
      label.append(checkbox, " " + choice.label + requirement);
      const row = document.createElement("div");
      row.append(label);
      choices.append(row);
    }
    button.disabled = false;
  }

  if (!window.cmApp) return;
  window.cmApp.courseModules().then(render, error => { status.textContent = error.message; });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = "Saving…";
    try {
      const enabled = Array.from(choices.querySelectorAll("input:checked"), input => input.value);
      const saved = await window.cmApp.saveCourseModules(enabled);
      if (saved.ok) return location.reload();
      status.textContent = saved.why;
    } catch (error) {
      status.textContent = error.message;
    }
    button.disabled = false;
  });
})();
