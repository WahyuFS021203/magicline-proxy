const API_URL = "https://magicline-proxy-coral.vercel.app/api";
// const STORAGE_KEY = "magicline_product_data";

const isSpecialOffer = window.location.pathname.includes("angebote");

const STORAGE_KEY = isSpecialOffer
  ? "magicline_product_data_special"
  : "magicline_product_data";

// ==========================================
// --- API & DATA HANDLING ---
// ==========================================

function getLocalData() {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

async function fetchAndSaveToStorage() {
  console.log("Status: Storage empty. Fetching API...");

  try {
    const resp = await fetch(`${API_URL}/contracts/rate-bundle`);
    // const data = await resp.json();
    // sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // return data;

    const data = await resp.json();

    // const filteredData = data.filter((product) =>
    //   ["ONE power FLEX", "ONE power YEAR", "ONE power DAY"].includes(
    //     product.name
    //   )
    // );
    // const filteredData = data.filter((product) =>
    //   ["ONE power FLEX", "ONE power YEAR"].includes(product.name)
    // );

    let filteredData;

    if (isSpecialOffer) {
      filteredData = data.filter(
        (product) =>
          !["ONE power FLEX", "ONE power YEAR", "ONE power DAY"].includes(
            product.name
          )
      );
    } else {
      filteredData = data.filter((product) =>
        ["ONE power FLEX", "ONE power YEAR"].includes(product.name)
      );
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filteredData));

    console.log("Data setelah filter:", filteredData);

    return filteredData;
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

async function getProduct() {
  let data = getLocalData() || (await fetchAndSaveToStorage());

  if (!data) {
    data = await fetchAndSaveToStorage();
  }

  if (data && data.length > 0) {
    data.sort((a, b) => {
      if (a.name === "ONE power YEAR") return -1;
      if (b.name === "ONE power YEAR") return 1;
      return 0;
    });

    renderProducts(data);
  }
}

// ==========================================
// --- RENDER PRODUCTS ---
// ==========================================

function renderProducts(products) {
  const container = document.querySelector(".membership_layout");
  const templateCard = document.querySelector(".membership_card");

  if (!container || !templateCard) return;

  container.innerHTML = "";

  products.forEach((product, index) => {
    const card = templateCard.cloneNode(true);
    card.dataset.raw = JSON.stringify(product);

    const updateText = (selector, text) => {
      const el = card.querySelector(`[data-product="${selector}"]`);
      if (el) el.textContent = text;
    };

    updateText("name", product.name);

    const listItems = product.description
      .split("\n")
      .filter((item) => item.trim() !== "");

    if (listItems.length > 0) {
      // Standard tariffs keep their short fixed subtitle. Every other tariff
      // (e.g. ONE power SPECIAL on /angebote) uses the first line of its
      // Magicline description, so the studio can change it in Magicline.
      const durationMap = {
        "ONE power YEAR": "Laufzeit: 365 Tage",
        "ONE power FLEX": "Monatlich flexibel kündbar – ab dem 1. Tag",
        "ONE power DAY": "Tageskarte - Einmaliger Zutritt",
      };

      updateText("duration", durationMap[product.name] || listItems[0]);

      updateText("trial", listItems[listItems.length - 1]);

      const middleItems = listItems.slice(1, -1);
      const descEl = card.querySelector('[data-product="description"]');

      if (descEl && middleItems.length > 0) {
        descEl.innerHTML = `<ul>${middleItems
          .map((item) => `<li>${item}</li>`)
          .join("")}</ul>`;
      }
    }

    // Format Terms
    const term = product.terms?.[0];
    if (term) {
      updateText("termValue", term.termValue);

      const unitMap = { DAY: "Tage", MONTH: "Monate", YEAR: "Jahre" };
      const rawUnit = term.termUnit.toUpperCase();
      updateText("termUnit", unitMap[rawUnit] || rawUnit);

      const billingPeriodEl = card.querySelector(
        '[data-product="billing-period"]'
      );

      if (billingPeriodEl) {
        if (product.name === "ONE power DAY") {
          billingPeriodEl.textContent = "/einmalig";
        }
      }

      const displayPrice =
        product.name === "ONE power DAY" && term.price <= 0
          ? term.flatFees?.find((fee) => fee.isStarterPackage)?.price ||
            term.flatFees?.[0]?.price ||
            0
          : term.price;

      const priceEl = card.querySelector(
        '[data-product="price"]:not(.text-color-grey)'
      );

      if (priceEl) priceEl.textContent = displayPrice.toFixed(2);

      if (product.name === "ONE power DAY") {
        updateText("per-day", displayPrice.toFixed(2));
      } else if (term.paymentFrequencyValue > 0) {
        updateText(
          "per-day",
          (displayPrice / term.paymentFrequencyValue).toFixed(2)
        );
      }
    }

    const actionButtons = card.querySelectorAll(
      '[data-portal="choice"], [data-form="next"]'
    );
    actionButtons.forEach((btn) => {
      btn.classList.remove("is-disable");
    });

    container.appendChild(card);
  });
}

// ==========================================
// --- FORM LOGIC ---
// ==========================================

function stepForm() {
  let currentStep = 1;
  const totalSteps = 5;
  const formData = {};
  let isEmailValidating = false;
  let isBankValidating = false;
  let isSubmittingToAPI = false;

  let pricingState = {
    starterFee: 0,
    recurringPrice: 0,
    serviceFee: 12.9,
    ptAddonFee: 0,
    ptAddonModuleId: null,
  };

  const DOM = {
    steps: document.querySelectorAll("[portal-step]"),
    specSidebar: document.querySelector('[data-form="specification"]'),
    packetSidebar: document.querySelector('[data-form="packet-details"]'),
    bottomNav: document.querySelector('[data-form="button-wrap"]'),
    nextBtn: document
      .querySelector('[data-form="button-wrap"]')
      ?.querySelector('[data-form="next"]'),
    backBtn: document.querySelector('[data-form="back"]'),
    form: document.getElementById("wf-form-Portal"),
    ptCheckbox: document.querySelector('[data-form="personal-training"]'),
  };

  // --- CORE UI/UX UPDATES ---
  function toggleError(input, show, message = "") {
    const errorEl = input.nextElementSibling;
    if (errorEl && errorEl.getAttribute("data-input-form") === "error-msg") {
      errorEl.textContent = message;
      errorEl.style.display = show ? "block" : "none";
    }
  }

  function debounce(func, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), delay);
    };
  }

  const debouncedValidateStep = debounce(validateStep, 800);

  function updatePricingUi() {
    const ptSidebarItem = document.querySelector(
      '[data-form="training-condition"]'
    );
    const sumElement = document.querySelector('[data-form="sum"]');
    const isPtSelected = DOM.ptCheckbox?.checked || false;

    if (ptSidebarItem) {
      ptSidebarItem.style.display = isPtSelected ? "grid" : "none";
    }

    const ptTermsItem = document
      .querySelector('[data-form="agree-terms-pt"]')
      ?.closest(".form_main_item");
    if (ptTermsItem) {
      ptTermsItem.style.display = isPtSelected ? "block" : "none";

      const ptTermsInput = ptTermsItem.querySelector('input[type="checkbox"]');
      if (ptTermsInput) {
        if (isPtSelected) {
          ptTermsInput.setAttribute("required", "required");
        } else {
          ptTermsInput.removeAttribute("required");
          ptTermsInput.checked = false;
        }
      }
    }

    // let total =
    //   pricingState.starterFee +
    //   pricingState.recurringPrice +
    //   pricingState.serviceFee;
    // if (isPtSelected) total += pricingState.ptAddonFee;

    let total = pricingState.starterFee + pricingState.recurringPrice;

    if (isPtSelected) total += pricingState.ptAddonFee;

    if (sumElement) {
      sumElement.innerText = `${total.toFixed(2)}€`;
    }
  }

  function updateContractDates(bonusDays = 0) {
    const today = new Date();
    const futureDate = new Date();

    console.log("update date: " + bonusDays);

    futureDate.setDate(today.getDate() + bonusDays);

    const formatDate = (date) =>
      `${String(date.getDate()).padStart(2, "0")}.${String(
        date.getMonth() + 1
      ).padStart(2, "0")}.${date.getFullYear()}`;

    const currentStr = formatDate(today);
    const startStr = formatDate(futureDate);
    const todayStr = formatDate(today);

    document
      .querySelectorAll('[data-form="current-date"]')
      .forEach((el) => (el.innerText = currentStr));
    document
      .querySelectorAll('[data-form="start-date"]')
      .forEach((el) => (el.innerText = startStr));
    // .forEach((el) => (el.innerText = "Todays"));

    formData["Trainingsstart"] = todayStr;
    formData["Vertragsbeginn"] = todayStr;
  }

  function updateUI() {
    DOM.steps.forEach((step) => {
      step.style.display =
        parseInt(step.getAttribute("portal-step")) === currentStep
          ? "flex"
          : "none";
    });

    updateStepProgress(currentStep);

    if (currentStep === 1) {
      if (DOM.specSidebar) DOM.specSidebar.style.display = "flex";
      if (DOM.packetSidebar) DOM.packetSidebar.style.display = "none";
      if (DOM.bottomNav) DOM.bottomNav.style.display = "none";
    } else {
      if (DOM.specSidebar) DOM.specSidebar.style.display = "none";
      if (DOM.packetSidebar) DOM.packetSidebar.style.display = "flex";
      if (DOM.bottomNav) DOM.bottomNav.style.display = "flex";

      const currentStepEl = document.querySelector(
        `[portal-step="${currentStep}"]`
      );

      initConditionalInput(currentStepEl);

      currentStepEl.querySelectorAll("input, select").forEach((input) => {
        input.addEventListener("input", debouncedValidateStep);
        input.addEventListener("change", validateStep);

        if (input.type === "email") {
          input.addEventListener("blur", handleEmailBlur);
        }
        if (input.type === "tel") {
          input.addEventListener("input", handleTelInput);
        }

        if (input.name === "IBAN") {
          input.addEventListener("blur", handleIbanBlur);
          input.addEventListener("input", (e) => {
            e.target.dataset.invalid = "true";
            validateStep();
          });
        }

        if (input.name === "Kontoinhaber") {
          input.addEventListener("blur", handleAccountHolderBlur);
          input.addEventListener("input", (e) => {
            e.target.dataset.invalid = "true";
            validateStep();
          });
        }
      });

      validateStep();
    }

    const nextBtnText =
      DOM.nextBtn?.querySelector(".button_main_text") || DOM.nextBtn;

    if (nextBtnText) {
      if (currentStep === 2) {
        nextBtnText.innerText = "Weiter zu deinen Vertragsdaten";
      } else if (currentStep === 3) {
        nextBtnText.innerText = "Weiter zu deinen Zahlungsdaten";
      } else if (currentStep === 4) {
        nextBtnText.innerText = "Weiter zu der Überprüfung";
      } else if (currentStep === 5) {
        nextBtnText.innerText = "Mitgliedschaft abschließen";
      }
    }

    initEditButtons();
    if (currentStep === 5) populateSummary();
  }

  // --- PRODUCT SELECTION ---
  function selectProduct(product, index = null) {
    const unitMapping = {
      DAY: "Tage",
      MONTH: "Monat",
      YEAR: "Jahr",
    };

    const term = product.terms[0];
    const ptModule = term.optionalModules?.find(
      (module) => module.name?.toLowerCase() === "personal training"
    );

    pricingState.ptAddonFee = ptModule?.price || 29.0;
    pricingState.ptAddonModuleId = ptModule?.id || null;
    formData["personalTrainingModuleId"] = ptModule?.id || null;
    formData["personalTrainingPrice"] = ptModule?.price || 29.0;
    const bonusDays = term?.rateBonusPeriods?.[0]?.termValue || 0;
    const bonusUnit = term?.rateBonusPeriods?.[0]?.termUnit || "";

    const ptWrapper = document.querySelector(".portal_trainer");

    if (ptWrapper) {
      ptWrapper.style.display = ptModule ? "flex" : "none";
    }

    if (!ptModule && DOM.ptCheckbox) {
      DOM.ptCheckbox.checked = false;
    }

    console.log(bonusDays);

    console.log("product: " + term);
    console.log("bonus day: " + bonusDays);

    updateContractDates(bonusDays);

    if (product.name === "ONE power YEAR") {
      term.paymentFrequencyValue = 12;
      term.paymentFrequencyUnit = "MONTH";
    } else if (product.name === "ONE power FLEX") {
      term.paymentFrequencyValue = 28;
      term.paymentFrequencyUnit = "DAY";
    } else if (product.name === "ONE power DAY") {
      term.paymentFrequencyValue = 1;
      term.paymentFrequencyUnit = "DAY";
    }

    const unit = term.paymentFrequencyUnit;
    let durationInDays = term.paymentFrequencyValue;
    const daysMultiplier = { MONTH: 30, YEAR: 365, WEEK: 7 };

    if (daysMultiplier[unit]) durationInDays *= daysMultiplier[unit];

    const starterFee =
      term.flatFees?.find((f) => f.name === "Startgebühr" || f.isStarterPackage)
        ?.price || 0;

    const recurringPrice = product.name === "ONE power DAY" ? 0 : term.price;

    const dayFlatFee =
      product.name === "ONE power DAY" && term.price <= 0
        ? term.flatFees?.find((fee) => fee.isStarterPackage)?.price ||
          term.flatFees?.[0]?.price ||
          0
        : 0;

    // const recurringPrice =
    //   product.name === "ONE power DAY" && term.price <= 0
    //     ? dayFlatFee
    //     : term.price;
    // const calculatedServiceFee = Math.max(
    //   0,
    //   (recurringPrice / durationInDays) * (durationInDays - 14)
    // );

    // const recurringPrice =
    //   product.name === "ONE power DAY" && term.price <= 0
    //     ? dayFlatFee
    //     : term.price;

    pricingState.starterFee = starterFee;
    pricingState.recurringPrice = recurringPrice;
    pricingState.serviceFee = 0;

    formData["rateBundleTermId"] = term.id;
    formData["Mitgliedschaft"] = product.name;
    formData["Mitgliedsbeitrag"] = `${recurringPrice.toFixed(2)}€`;
    formData["Startgebuehr"] = `${starterFee.toFixed(2)}€`;

    const startDateContainer = document.querySelector(
      '[data-detail="start-date"]'
    );

    if (startDateContainer) {
      const paragraphs = startDateContainer.children;

      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];

        if (product.name === "ONE power DAY") {
          p.style.display = p.classList.contains("is-day")
            ? "flow-root"
            : "none";
        } else {
          p.style.display = p.classList.contains("is-day")
            ? "none"
            : "flow-root";
        }
      }
    }

    if (DOM.packetSidebar) {
      const updateText = (selector, text) => {
        const el = DOM.packetSidebar.querySelector(`[data-form="${selector}"]`);
        if (el) el.innerText = text;
      };

      updateText("membership", product.name);
      updateText("membership-fee", formData["Mitgliedsbeitrag"]);
      updateText("registration-fee", formData["Startgebuehr"]);
      // updateText("restmonat", `${calculatedServiceFee.toFixed(2)}€`);
      // updateText("contract-duration", bonusDays);

      const membershipFeeEl = DOM.packetSidebar.querySelector(
        '[data-form="membership-fee"]'
      );
      if (membershipFeeEl) {
        const parentItem =
          membershipFeeEl.closest(".portal_result_item") ||
          membershipFeeEl.parentElement;

        if (product.name === "ONE power DAY") {
          parentItem.style.display = "none";
        } else {
          parentItem.style.display = "grid";
        }
      }

      // const unitMap = { DAY: "Tage", MONTH: "Monate", YEAR: "Jahre" };
      // updateText("contract-unit", unitMap[bonusUnit] || bonusUnit);
      // Contract term straight from Magicline (termValue / termUnit),
      // so changes in Magicline show up without code changes.
      const termUnitMap = {
        DAY: ["Tag", "Tage"],
        WEEK: ["Woche", "Wochen"],
        MONTH: ["Monat", "Monate"],
        YEAR: ["Jahr", "Jahre"],
      };
      const termValue = Number(term.termValue) || 0;
      const termUnitKey = String(term.termUnit || "DAY").toUpperCase();
      const termUnitText = termUnitMap[termUnitKey]
        ? termUnitMap[termUnitKey][termValue === 1 ? 0 : 1]
        : termUnitKey;

      updateText("contract-duration", termValue);
      updateText("contract-unit", termUnitText);

      // const cancelUnitText =
      //   term.cancellationPeriodUnit === "WEEK" ? "Wochen" : "Monat";
      // updateText(
      //   "cancellation-period",
      //   `${term.cancellationPeriod} ${cancelUnitText}`
      // );

      const cancelInfoIcon = DOM.packetSidebar.querySelector(
        '[data-detail="cancellation-period"]'
      );

      if (
        product.name === "ONE power DAY" ||
        term.cancellationPeriod === null
      ) {
        updateText("cancellation-period", "Keine Frist");

        if (cancelInfoIcon) {
          cancelInfoIcon.style.display = "inline-block";
          cancelInfoIcon.title =
            "Es handelt sich um eine Tageskarte, daher wird keine Mitgliedschaft abgeschlossen sondern lediglich die einmalige Gebühr von 9€ abgebucht.";
        }
      } else {
        const cancelUnitText =
          term.cancellationPeriodUnit === "WEEK" ? "Wochen" : "Monat";
        updateText(
          "cancellation-period",
          `${term.cancellationPeriod} ${cancelUnitText}`
        );

        if (cancelInfoIcon) {
          cancelInfoIcon.style.display = "none";
        }
      }

      updatePricingUi();
    }

    currentStep = 2;
    updateUI();
  }

  function initPortalLogic() {
    document.querySelectorAll(".membership_card").forEach((card, index) => {
      card
        .querySelectorAll('[data-form="next"], [data-portal="choice"]')
        .forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            selectProduct(JSON.parse(card.dataset.raw), index);
            window.scrollTo(0, 0);
          });
        });
    });

    const savedProduct = sessionStorage.getItem("selected_product");
    if (savedProduct) {
      selectProduct(JSON.parse(savedProduct));
      sessionStorage.removeItem("selected_product");
    }
  }

  // --- VALIDATIONS & HELPERS ---
  async function validateStep() {
    if (isSubmittingToAPI) return;

    if (currentStep === 1 || !DOM.nextBtn) return;

    const currentStepEl = document.querySelector(
      `[portal-step="${currentStep}"]`
    );
    if (!currentStepEl) return;

    let allFieldsValid = true;

    currentStepEl
      .querySelectorAll("input, select, textarea")
      .forEach((input) => {
        let isValid = true;

        if (input.hasAttribute("required")) {
          if (input.type === "checkbox") {
            isValid = input.checked;
          } else if (input.type === "radio") {
            isValid = !!currentStepEl.querySelector(
              `input[name="${input.name}"]:checked`
            );
          } else {
            isValid = input.value.trim() !== "";
          }
        }

        if (isValid && input.type === "email" && input.value) {
          isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
        }
        if (isValid && input.type === "tel" && input.value) {
          isValid = /^\+?\d+$/.test(input.value);
        }
        if (input.dataset.invalid === "true") {
          isValid = false;
        }

        if (!isValid) allFieldsValid = false;
      });

    const isDisabled = !allFieldsValid || isEmailValidating || isBankValidating;
    DOM.nextBtn.disabled = isDisabled;
    DOM.nextBtn.style.opacity = isDisabled ? "0.5" : "1";
    DOM.nextBtn.style.pointerEvents = isDisabled ? "none" : "auto";
  }

  async function handleEmailBlur(e) {
    const input = e.target;
    const email = input.value.trim();

    if (email.includes("@")) {
      isEmailValidating = true;
      validateStep();
      // toggleError(input, true, "Wird geprüft...");
      toggleError(input, true, "");

      try {
        const res = await fetch(
          `https://dns.google/resolve?name=${email.split("@")[1]}&type=MX`
        );
        const data = await res.json();
        const valid = res.ok && data.Answer && data.Answer.length > 0;

        input.dataset.invalid = valid ? "false" : "true";
        toggleError(
          input,
          !valid,
          valid ? "" : "E-Mail-Domain nicht gefunden."
        );
      } catch (err) {
        toggleError(input, true, "Fehler bei Validierung.");
      } finally {
        isEmailValidating = false;
        validateStep();
      }
    }
  }

  // --- BANK VALIDATION ---
  function normalizeIban(value) {
    return value.replace(/\s+/g, "").toUpperCase();
  }

  async function handleIbanBlur(e) {
    const input = e.target;

    const iban = normalizeIban(input.value);

    if (iban.length === 0) return;

    if (iban.length < 15) {
      input.dataset.invalid = "true";
      toggleError(
        input,
        true,
        "Die eingegebene IBAN ist zu kurz. Eine gültige IBAN hat mindestens 15 Zeichen."
      );
      validateStep();
      return;
    }

    isBankValidating = true;
    validateStep();
    // toggleError(input, true, "IBAN wird geprüft...");
    toggleError(input, true, "");

    try {
      const query = new URLSearchParams({ iban }).toString();

      const resp = await fetch(`${API_URL}/validations/iban?${query}`, {
        method: "GET",
      });

      const responseData = await resp.json();

      let valid = true;
      let errorMessage = "";

      if (responseData.validIban !== true) {
        valid = false;
        errorMessage =
          "Die eingegebene IBAN ist ungültig. Bitte überprüfen Sie die Zahlenfolge.";
      } else if (responseData.bankName == null) {
        valid = false;
        errorMessage =
          "Zu dieser IBAN konnte keine Bank gefunden werden. Bitte überprüfen Sie Ihre Eingabe.";
      }

      input.dataset.invalid = valid ? "false" : "true";
      toggleError(input, !valid, errorMessage);
    } catch (err) {
      input.dataset.invalid = "true";
      toggleError(
        input,
        true,
        "Verbindungsfehler bei der IBAN-Prüfung. Bitte versuchen Sie es später noch einmal."
      );
    } finally {
      isBankValidating = false;
      validateStep();
    }
  }

  async function handleAccountHolderBlur(e) {
    const input = e.target;
    const name = input.value.trim();

    if (name.length === 0) return;

    if (name.length < 3) {
      input.dataset.invalid = "true";
      toggleError(input, true, "Der Name muss mindestens 3 Zeichen lang sein.");
      validateStep();
      return;
    }

    isBankValidating = true;
    validateStep();
    // toggleError(input, true, "Wird geprüft...");
    toggleError(input, true, "");

    try {
      const query = new URLSearchParams({ accountHolder: name }).toString();
      const resp = await fetch(
        `${API_URL}/validations/account-holder?${query}`,
        {
          method: "GET",
        }
      );

      const responseData = await resp.json();
      const valid = responseData.valid === true;

      input.dataset.invalid = valid ? "false" : "true";
      const errorMessage = valid
        ? ""
        : responseData.errorMessages?.[0] || "Ungültiger Kontoinhaber.";
      toggleError(input, !valid, errorMessage);
    } catch (err) {
      input.dataset.invalid = "true";
      toggleError(input, true, "Fehler bei der Überprüfung.");
    } finally {
      isBankValidating = false;
      validateStep();
    }
  }

  function handleTelInput(e) {
    e.target.value = e.target.value.replace(/[^\d+]/g, "");

    debouncedValidateStep();
  }

  function captureCurrentStepData() {
    document
      .querySelector(`[portal-step="${currentStep}"]`)
      ?.querySelectorAll("input, select, textarea")
      .forEach((input) => {
        if (input.type === "radio") {
          if (input.checked) formData[input.name] = input.value;
        } else if (input.type === "checkbox") {
          formData[input.name] = input.checked ? "Ja" : "Nein";
        } else {
          formData[input.name] = input.value;
        }
      });
  }

  function initConditionalInput(container) {
    const condInput = container.querySelector('[data-form="input-condition"]');
    if (!condInput) return;

    const wrapper = condInput.parentElement;

    const update = () => {
      const isWeitere =
        container.querySelector('input[type="radio"]:checked')?.value ===
        "Sonstiges";
      wrapper.style.display = isWeitere ? "block" : "none";

      if (isWeitere) {
        condInput.setAttribute("required", "required");
      } else {
        condInput.removeAttribute("required");
        condInput.value = "";
        toggleError(condInput, false);
      }
      validateStep();
    };

    container
      .querySelectorAll('input[type="radio"]')
      .forEach((r) => r.addEventListener("change", update));
    update();
  }

  function initEditButtons() {
    document.querySelectorAll("[data-form-edit]").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const targetStep = parseInt(btn.getAttribute("data-form-edit"));
        if (targetStep) {
          currentStep = targetStep;
          updateUI();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      };
    });
  }

  function populateSummary() {
    updatePricingUi();

    document.querySelectorAll(".portal_result_item").forEach((item) => {
      const title = item
        .querySelector(".portal_result_title")
        ?.innerText.trim();
      const descEl = item.querySelector(".portal_result_desc");
      if (title && formData[title]) descEl.innerText = formData[title];
    });

    const selectedSource = formData["Wie bist du auf uns aufmerksam geworden?"];
    const extraInfo = formData["Hier eingeben"];
    const radioDisplay = document.querySelector('[data-form="radio-value"]');
    const additionalDisplay = document.querySelector(
      '[data-form="radio-input-value"]'
    );

    if (radioDisplay) radioDisplay.innerText = selectedSource || "";
    if (additionalDisplay) {
      if (selectedSource === "Weitere" && extraInfo?.trim()) {
        additionalDisplay.innerText = extraInfo;
        additionalDisplay.style.display = "block";
      } else {
        additionalDisplay.style.display = "none";
        additionalDisplay.innerText = "";
      }
    }

    const ageContainer = document.querySelector('[data-from="age-condition"]');
    if (ageContainer) {
      // const formatISO = (str) => {
      //   if (!str || typeof str !== "string") return "";

      //   if (str.includes("-")) return str;

      //   if (str.includes(".")) {
      //     const parts = str.split(".");
      //     let year = parts[2];

      //     if (year && year.length === 2) {
      //       year = parseInt(year) > 24 ? `19${year}` : `20${year}`;
      //     }
      //     return `${year}-${parts[1]}-${parts[0]}`;
      //   }
      //   return str;
      // };

      const formatISO = (str) => {
        if (!str || typeof str !== "string") return "";

        if (str.includes(".")) {
          const parts = str.split(".");
          let year = parts[2];
          if (year.length === 2)
            year = parseInt(year) > 24 ? `19${year}` : `20${year}`;
          return `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(
            2,
            "0"
          )}`;
        }

        if (str.includes("-")) {
          const parts = str.split("-");

          if (parts[0].length === 4) {
            return str;
          }

          if (parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(
              2,
              "0"
            )}-${parts[0].padStart(2, "0")}`;
          }
        }

        return str;
      };

      const isoString = formatISO(formData["Geburtstag"]);
      const birthDate = new Date(isoString);

      let isMinor = false;
      if (!isNaN(birthDate.getTime())) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - birthDate.getFullYear();

        isMinor =
          age < 18 ||
          (age === 18 &&
            new Date() <
              new Date(currentYear, birthDate.getMonth(), birthDate.getDate()));
      }

      // ageContainer.style.display = isMinor ? "grid" : "none";
      if (isMinor) {
        ageContainer.classList.remove("hide-age-container");
      } else {
        ageContainer.classList.add("hide-age-container");
      }

      ageContainer.querySelectorAll("input").forEach((input) => {
        if (isMinor) {
          input.setAttribute("required", "required");
        } else {
          input.removeAttribute("required");
          input.value = "";
        }
      });
    }

    validateStep();
  }

  function updateStepProgress(step) {
    const svgEl = document.querySelector(".portal_head_step");
    const originalPath = document.getElementById("progress-ring");
    let progressCircle = document.getElementById("gsap-progress-circle");

    if (!progressCircle && svgEl) {
      if (originalPath) originalPath.style.display = "none";

      progressCircle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      progressCircle.setAttribute("id", "gsap-progress-circle");
      progressCircle.setAttribute("cx", "27");
      progressCircle.setAttribute("cy", "27");
      progressCircle.setAttribute("r", "24.3");
      progressCircle.setAttribute("fill", "none");
      progressCircle.setAttribute("stroke", "#008BD2");
      progressCircle.setAttribute("stroke-width", "5.4");
      progressCircle.setAttribute("stroke-linecap", "round");
      progressCircle.setAttribute("transform", "rotate(-90 27 27)");

      svgEl.appendChild(progressCircle);
    }

    if (progressCircle) {
      const circumference = 2 * Math.PI * 24.3;
      const totalSteps = 6;

      gsap.set(progressCircle, { strokeDasharray: circumference });

      const progress = Math.min(step / totalSteps, 1);

      gsap.to(progressCircle, {
        strokeDashoffset: circumference * (1 - progress),
        duration: 0.8,
        ease: "power2.out",
      });
    }

    const stepNumberDiv = document.querySelector(
      ".portal_from_progress div:first-child"
    );
    if (stepNumberDiv && stepNumberDiv.innerText !== step.toString()) {
      gsap.to(stepNumberDiv, {
        y: -10,
        opacity: 0,
        duration: 0.2,
        onComplete: () => (stepNumberDiv.innerText = step),
      });
      gsap.fromTo(
        stepNumberDiv,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: "back.out(1.7)", delay: 0.2 }
      );
    }

    const heading = document.querySelector(".portal_heading");
    const desc = document.querySelector(".portal_desc");

    if (heading && heading.getAttribute(`text-step-${step}`)) {
      heading.innerText = heading.getAttribute(`text-step-${step}`);
    }
    if (desc && desc.getAttribute(`text-step-desc-${step}`)) {
      desc.innerText = desc.getAttribute(`text-step-desc-${step}`);
    }
  }

  // --- API SUBMIT ---
  async function submitContract() {
    const errorContainer = DOM.bottomNav?.querySelector(
      ".form_main_label_error"
    );
    if (errorContainer) {
      errorContainer.style.display = "none";
      errorContainer.innerText = "";
    }

    // const formatISO = (str) =>
    //   str
    //     ? `${str.split(".")[2]}-${str.split(".")[1]}-${str.split(".")[0]}`
    //     : "";

    const formatISO = (str) => {
      if (!str || typeof str !== "string") return "";

      if (str.includes(".")) {
        const parts = str.split(".");
        let year = parts[2];
        if (year.length === 2)
          year = parseInt(year) > 24 ? `19${year}` : `20${year}`;
        return `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(
          2,
          "0"
        )}`;
      }

      if (str.includes("-")) {
        const parts = str.split("-");

        if (parts[0].length === 4) {
          return str;
        }

        if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(
            2,
            "0"
          )}`;
        }
      }

      return str;
    };

    let sourceValue =
      formData["Wie bist du auf uns aufmerksam geworden?"] || "Keine Angabe";

    if (sourceValue === "Sonstiges" && formData["Hier eingeben"]) {
      sourceValue = formData["Hier eingeben"];
    }

    const notesString = `Marketingherkunft: ${sourceValue}`;

    const payload = {
      studioId: 1210012010,
      contract: {
        rateBundleTermId: formData["rateBundleTermId"],
        startDate: formatISO(formData["Vertragsbeginn"]),
        preuseDate: formatISO(formData["Trainingsstart"]),
        notes: notesString,
        contractSignature: {
          base64Svg:
            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
          textBlockId: 0,
        },
      },
      // customer: {
      //   firstname: formData["Vorname"],
      //   lastname: formData["Nachname"],
      //   gender: formData["Geschlecht"] === "Männlich" ? "MALE" : "FEMALE",
      //   dateOfBirth: formatISO(formData["Geburtstag"]),
      //   email: formData["E-Mail-Adresse"],
      //   telephone_mobile: formData["Telefonnummer"],
      //   street: formData["Straße"],
      //   houseNumber: formData["Nr."],
      //   zipCode: formData["PLZ"],
      //   city: formData["Ort"],
      //   countryCode: "DE",
      //   paymentChoice: "DIRECT_DEBIT",
      //   bankAccount: {
      //     accountHolder: formData["Kontoinhaber"],
      //     iban: normalizeIban(formData["IBAN"] || ""),
      //   },
      //   communicationPreferences: [
      //     { messageCategoryId: 1, activeCommunicationChannels: ["EMAIL"] },
      //   ],
      // },
      customer: {
        firstname: formData["Vorname"],
        lastname: formData["Nachname"],
        gender: formData["Geschlecht"] === "Männlich" ? "MALE" : "FEMALE",
        dateOfBirth: formatISO(formData["Geburtstag"]),
        email: formData["E-Mail-Adresse"],
        telephone_mobile: formData["Telefonnummer"],
        street: formData["Straße"],
        houseNumber: formData["Nr."],
        zipCode: formData["PLZ"],
        city: formData["Ort"],
        countryCode: "DE",
        paymentChoice: "DIRECT_DEBIT",
        bankAccount: {
          accountHolder: formData["Kontoinhaber"],
          iban: normalizeIban(formData["IBAN"] || ""),
        },
        // communicationPreferences: [
        //   {
        //     messageCategoryId: 1210001650,
        //     activeCommunicationChannels: ["EMAIL"],
        //   },
        // ],
        communicationPreferences: [
          {
            messageCategoryId: 1210001650,
            activeCommunicationChannels: ["EMAIL"],
          },
          {
            messageCategoryId: 1210001651,
            activeCommunicationChannels: ["EMAIL"],
          },
          {
            messageCategoryId: 1210001652,
            activeCommunicationChannels: ["EMAIL"],
          },
          {
            messageCategoryId: 1210001653,
            activeCommunicationChannels: ["EMAIL"],
          },
        ],
        privacyConfiguration: {
          email: true,
          letter: true,
          mySportsMessage: true,
          phone: true,
          textMessage: true,
        },
      },
    };

    const isPTChecked = DOM.ptCheckbox?.checked || false;

    if (isPTChecked && formData["personalTrainingModuleId"]) {
      payload.contract.optionalRateBundleTermModules = [
        {
          id: formData["personalTrainingModuleId"],
        },
      ];
    }

    let contractCreated = false;

    try {
      const resp = await fetch(`${API_URL}/contracts/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await resp.json();

      // if (resp.ok) {
      //   const ptCheckbox = document.querySelector(
      //     '[data-form="personal-training"]'
      //   );
      //   const isPTChecked = ptCheckbox?.checked ?? false;

      //   if (isPTChecked) {
      //     if (isPTChecked) {
      //       // 1. Cari form Personal Training
      //       const ptForm = document.getElementById(
      //         "wf-form-Personal-Training-2"
      //       );

      //       if (ptForm) {
      //         const nameInput = ptForm.querySelector('input[name="Name"]');
      //         const emailInput = ptForm.querySelector(
      //           'input[name="E-Mail Adresse"]'
      //         );
      //         const phoneInput = ptForm.querySelector(
      //           'input[name="Telefonnummer"]'
      //         );

      //         if (nameInput) {
      //           nameInput.value = `${formData["Vorname"] || ""} ${
      //             formData["Nachname"] || ""
      //           }`.trim();
      //         }
      //         if (emailInput) {
      //           emailInput.value = formData["E-Mail-Adresse"] || "";
      //         }
      //         if (phoneInput) {
      //           phoneInput.value = formData["Telefonnummer"] || "";
      //         }

      //         let ptSubmitTrigger = document.createElement("input");
      //         ptSubmitTrigger.type = "submit";
      //         ptSubmitTrigger.style.display = "none";
      //         ptForm.appendChild(ptSubmitTrigger);
      //         ptSubmitTrigger.click();
      //         ptSubmitTrigger.remove();
      //       }
      //     }
      //   }

      //   let submitTrigger = document.createElement("input");
      //   submitTrigger.type = "submit";
      //   submitTrigger.style.display = "none";
      //   DOM.form.appendChild(submitTrigger);
      //   submitTrigger.click();
      //   submitTrigger.remove();

      //   // setTimeout(() => {
      //   //   window.location.href = "/success";
      //   // }, 800);
      // } else {

      if (resp.ok) {
        contractCreated = true;
        const ptCheckbox = document.querySelector(
          '[data-form="personal-training"]'
        );
        const isPTChecked = ptCheckbox?.checked ?? false;

        const submitMainForm = () => {
          let submitTrigger = document.createElement("input");
          submitTrigger.type = "submit";
          submitTrigger.style.display = "none";
          DOM.form.appendChild(submitTrigger);
          submitTrigger.click();
          submitTrigger.remove();
        };

        if (isPTChecked) {
          const ptForm = document.getElementById("wf-form-Personal-Training-2");

          if (ptForm) {
            const nameInput = ptForm.querySelector(
              'input[name="Name"], input#Name'
            );
            const emailInput = ptForm.querySelector(
              'input[name="E-Mail Adresse"], input[name="Email"], input[type="email"]'
            );
            const phoneInput = ptForm.querySelector(
              'input[name="Telefonnummer"], input[name="Phone"], input[type="tel"]'
            );
            const birthdateInput = ptForm.querySelector(
              'input[name="Birthdate"], input[name="Geburtstag"]'
            );
            const memberIdInput = ptForm.querySelector(
              'input[name="Mitgliedsnummer"]'
            );

            const parentNameInput = ptForm.querySelector(
              'input[name="Parent Name"], input[name="Name Erziehungsberechtigter"]'
            );
            const parentEmailInput = ptForm.querySelector(
              'input[name="Parent E-Mail"], input[name="E-Mail Erziehungsberechtigter"]'
            );

            const ptFileInput = ptForm.querySelector(
              'input[name="Einverständniserklärung"][type="file"]'
            );

            const mainFileInput = document.querySelector(
              'input[type="file"][id="file"]'
            );

            if (nameInput) {
              nameInput.value = `${formData["Vorname"] || ""} ${
                formData["Nachname"] || ""
              }`.trim();
            }

            if (emailInput) {
              emailInput.value = formData["E-Mail-Adresse"] || "";
            }

            if (phoneInput) {
              phoneInput.value = formData["Telefonnummer"] || "";
            }

            if (birthdateInput) {
              birthdateInput.value = formData["Geburtstag"] || "";
            }

            if (memberIdInput) {
              memberIdInput.value = result.customerNumber || "";
            }

            if (parentNameInput) {
              parentNameInput.value =
                formData["Name Erziehungsberechtigter"] || "";
            }

            if (parentEmailInput) {
              parentEmailInput.value =
                formData["E-Mail Erziehungsberechtigter"] || "";
            }

            if (
              ptFileInput &&
              mainFileInput &&
              mainFileInput.files.length > 0
            ) {
              try {
                const dataTransfer = new DataTransfer();

                dataTransfer.items.add(mainFileInput.files[0]);

                ptFileInput.files = dataTransfer.files;
              } catch (error) {
                console.error(error);
              }
            } else {
              console.log(
                "Die Hauptdatei wurde nicht gefunden oder wurde nicht hochgeladen."
              );
            }

            let ptSubmitTrigger = document.createElement("input");
            ptSubmitTrigger.type = "submit";
            ptSubmitTrigger.style.display = "none";
            ptForm.appendChild(ptSubmitTrigger);
            ptSubmitTrigger.click();
            ptSubmitTrigger.remove();

            setTimeout(() => {
              submitMainForm();
            }, 1000);
          } else {
            submitMainForm();
          }
        } else {
          submitMainForm();
        }
      } else {
        const isoDob = formatISO(formData["Geburtstag"]);
        const birthDate = new Date(isoDob);
        let age = new Date().getFullYear() - birthDate.getFullYear();
        const m = new Date().getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) {
          age--;
        }

        let errorMsg = `Fehler: ${
          result.message || "Die Buchung konnte nicht verarbeitet werden."
        }`;

        if (
          result.errorCodes?.includes("EMAIL_ALREADY_REGISTERED") ||
          result.errorCodes?.includes("REQUEST_IN_PROGRESS")
        ) {
          errorMsg = result.message;
        } else if (result.errorCodes?.includes("INVALID_IBAN")) {
          errorMsg = "Die angegebene IBAN ist ungültig. Bitte prüfen.";
        } else if (age < 15) {
          errorMsg =
            "Du musst mindestens 15 Jahre alt sein, um einen Vertrag abzuschließen.";
        }

        if (errorContainer) {
          errorContainer.innerText = errorMsg;
          errorContainer.style.display = "block";
        }
      }
    } catch (error) {
      console.error("Detail Error:", error);
      if (errorContainer) {
        errorContainer.innerText =
          "Netzwerkfehler: Verbindung zum Buchungssystem fehlgeschlagen.";
        errorContainer.style.display = "block";
      }
    } finally {
      if (DOM.nextBtn && !contractCreated) {
        const finalTextEl =
          DOM.nextBtn.querySelector(".button_main_text") || DOM.nextBtn;
        finalTextEl.innerText = "Mitgliedschaft abschließen";
        DOM.nextBtn.disabled = false;
        DOM.nextBtn.style.pointerEvents = "auto";
        DOM.nextBtn.style.opacity = "1";
        isSubmittingToAPI = false;
      }
    }
  }

  // --- EVENT LISTENERS ---
  DOM.ptCheckbox?.addEventListener("change", updatePricingUi);

  DOM.nextBtn?.addEventListener("click", async (e) => {
    e.preventDefault();

    if (isSubmittingToAPI) return;

    captureCurrentStepData();

    if (currentStep < totalSteps) {
      currentStep++;
      updateUI();
      window.scrollTo(0, 0);
    } else {
      isSubmittingToAPI = true;

      DOM.nextBtn.disabled = true;
      DOM.nextBtn.style.pointerEvents = "none";
      DOM.nextBtn.style.opacity = "0.5";

      const loadingTextEl =
        DOM.nextBtn.querySelector(".button_main_text") || DOM.nextBtn;
      loadingTextEl.innerText = "Wird verarbeitet..."; // "Sedang diproses..."

      await submitContract();
    }
  });

  DOM.backBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentStep > 1) {
      currentStep--;
      updateUI();
    }
    window.scrollTo(0, 0);
  });

  // Init
  initPortalLogic();
  updateUI();
}

// ==========================================
// --- INITIALIZATION ---
// ==========================================

async function initFunction() {
  await getProduct();
  stepForm();
}

window.addEventListener("DOMContentLoaded", initFunction);

document.querySelector(".d_portal_link")?.addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "/vertragsuebernahme";
});

document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("dialog-purpose");
  const openBtn = document.querySelector(
    'a[data-modal-element="dialog-purpose"]'
  );
  const closeBtn = dialog.querySelector('button[command="close"]');

  // Membuka Dialog
  openBtn.addEventListener("click", (e) => {
    e.preventDefault(); // Mencegah link pindah halaman
    dialog.showModal();
  });

  // Menutup Dialog
  closeBtn.addEventListener("click", () => {
    dialog.close();
  });

  // Opsional: Menutup dialog jika bagian luar (backdrop) diklik
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      dialog.close();
    }
  });
});
