// modules/dice.js
// Ansvar: dice-modal (d12)

function rollD12() {
  return Math.floor(Math.random() * 12) + 1;
}

export function initDiceUI({
  openBtnId = "openDice",
  modalId = "diceModal",
  rollBtnId = "rollD12",
  valueId = "d12Value",
} = {}) {
  const openBtn = document.getElementById(openBtnId);
  const modalEl = document.getElementById(modalId);
  const rollBtn = document.getElementById(rollBtnId);
  const valueEl = document.getElementById(valueId);

  if (!openBtn || !modalEl || !rollBtn || !valueEl) return;

  let modal = null;

  openBtn.addEventListener("click", () => {
    modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    valueEl.textContent = "—";
    modal.show();
  });

  rollBtn.addEventListener("click", () => {
    valueEl.textContent = String(rollD12());
  });
}
