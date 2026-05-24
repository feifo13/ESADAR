import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useLookups } from "../contexts/LookupsContext.jsx";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import { useNotification } from "../contexts/NotificationContext.jsx";
import PreviousNextControls from "../components/PreviousNextControls.jsx";
import ArticleCard from "../components/ArticleCard.jsx";
import ScrollRailControls from "../components/ScrollRailControls.jsx";
import LeadCaptureCta from "../components/LeadCaptureCta.jsx";
import SmartImage from "../components/SmartImage.jsx";
import SummaryItemCard from "../components/SummaryItemCard.jsx";
import { formatCurrency } from "../lib/format.js";
import {
  calculateShippingCost,
  formatWeightKg,
  usesWeightRanges,
} from "../lib/shippingRates.js";
import { apiFetch } from "../lib/api.js";
import { articlePath } from "../lib/routes.js";
import {
  getEmailValidationMessage,
  getFriendlyErrorMessage,
  getRequiredValidationMessage,
  notifyFormStatus,
} from "../lib/validation.js";
import { scrollElementIntoViewWithSiteChromeOffset } from "../lib/siteChromeOffset.js";

const STORAGE_KEY = "esadar-checkout-draft";
const COMPLETE_STORAGE_KEY = "esadar-checkout-complete";

const initialGuest = {
  firstName: "",
  lastName: "",
  birthDate: "",
  email: "",
  address: "",
  phone: "",
  instagram: "",
};

const steps = [
  { key: "resumen", label: "Resumen de compra", kicker: "Paso 1" },
  { key: "comprador", label: "Datos de comprador", kicker: "Paso 2" },
  { key: "pago", label: "Método de pago", kicker: "Paso 3" },
  { key: "envio", label: "Método de envío", kicker: "Paso 4" },
  {
    key: "confirmacion",
    label: "Confirmar órden",
    kicker: "Paso 5",
  },
];

function readDraft() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);

    setMatches(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
}

function getCheckoutLineKey(item) {
  return String(item.cartLineKey ?? item.id ?? item.articleId);
}

function getOfferSavings(item) {
  if (!item?.acceptedOffer) return 0;
  return Math.max(
    0,
    Number(item.salePrice || 0) - Number(item.acceptedOffer.price || 0),
  );
}

const DEFAULT_OFFICIAL_RATES_LABEL = "Ver tarifas oficiales";

function getOfficialRatesHref(method) {
  const officialUrl = String(method?.officialRatesUrl || "").trim();
  if (officialUrl) return officialUrl;
  return String(method?.officialRatesFilePath || "").trim();
}

function getOfficialRatesLabel(method) {
  return (
    String(method?.officialRatesLabel || "").trim() ||
    DEFAULT_OFFICIAL_RATES_LABEL
  );
}

function isCheckoutItemUnavailable(item) {
  const publicationStatus = String(
    item?.publicationStatus || "ACTIVE",
  ).toUpperCase();
  const articleStatus = String(
    item?.articleStatus ||
      (publicationStatus === "ACTIVE"
        ? item?.stockStatus || "ACTIVE"
        : "INACTIVE"),
  ).toUpperCase();
  const stockStatus = String(item?.stockStatus || articleStatus).toUpperCase();
  const quantityAvailable = Number(
    item?.quantityAvailable ?? item?.maxQuantity ?? 0,
  );

  return (
    publicationStatus !== "ACTIVE" ||
    articleStatus !== "ACTIVE" ||
    stockStatus !== "ACTIVE" ||
    quantityAvailable <= 0
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 15H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    items,
    removeItem,
    updateQuantity,
    refreshCartAvailability,
    flushCartSync,
  } = useCart();
  const { user, isAuthenticated } = useAuth();
  const {
    shippingMethodOptions,
    paymentMethodOptions,
    lookupError,
    loaded: lookupsLoaded,
    refreshLookups,
  } = useLookups();
  const { notifyMobileStatus } = useMobileMenu();
  const { notifyError } = useNotification();
  const checkoutShellRef = useRef(null);
  const checkoutStepContentRef = useRef(null);
  const checkoutInterestTrackRef = useRef(null);

  const savedDraft = readDraft();
  const [guest, setGuest] = useState(savedDraft?.guest || initialGuest);
  const [shippingMethodId, setShippingMethodId] = useState(
    savedDraft?.shippingMethodId || "",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    savedDraft?.paymentMethod || "",
  );
  const [notes, setNotes] = useState(savedDraft?.notes || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [interestArticles, setInterestArticles] = useState([]);
  const [interestArticlesLoaded, setInterestArticlesLoaded] = useState(false);

  const cartAvailabilitySignature = useMemo(
    () =>
      items
        .map((item) => `${item.articleId}:${item.quantity}`)
        .sort()
        .join("|"),
    [items],
  );

  const cartArticleIdsSignature = useMemo(
    () =>
      [...new Set(items.map((item) => Number(item.articleId)).filter(Boolean))]
        .sort((a, b) => a - b)
        .join("|"),
    [items],
  );

  const cartArticleIds = useMemo(
    () =>
      new Set(
        cartArticleIdsSignature
          ? cartArticleIdsSignature.split("|").map((item) => Number(item))
          : [],
      ),
    [cartArticleIdsSignature],
  );

  useEffect(() => {
    if (!cartAvailabilitySignature) return;
    void refreshCartAvailability?.(items);
  }, [cartAvailabilitySignature, isAuthenticated]);

  const currentStepKey = location.pathname.split("/")[2] || "resumen";
  const currentStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStepKey),
  );
  const currentStep = steps[currentStepIndex] || steps[0];
  const isMobileSummary = useMediaQuery("(max-width: 780px)");

  useEffect(() => {
    if (currentStepKey !== "resumen" || !items.length) {
      setInterestArticles([]);
      setInterestArticlesLoaded(false);
      return undefined;
    }

    let ignore = false;
    setInterestArticlesLoaded(false);

    async function loadInterestArticles() {
      try {
        const response = await apiFetch(
          "/api/public/articles?page=1&pageSize=12&sort=intake_desc",
        );
        if (ignore) return;

        const nextItems = (response.items || [])
          .filter((article) => {
            if (cartArticleIds.has(Number(article.id))) return false;
            const publicationStatus = String(
              article.publicationStatus || article.status || "ACTIVE",
            ).toUpperCase();
            const stockStatus = String(
              article.stockStatus || "ACTIVE",
            ).toUpperCase();
            return (
              publicationStatus === "ACTIVE" &&
              stockStatus === "ACTIVE" &&
              Number(article.quantityAvailable || 0) > 0
            );
          })
          .slice(0, 8);

        setInterestArticles(nextItems);
        setInterestArticlesLoaded(true);
      } catch {
        if (!ignore) {
          setInterestArticles([]);
          setInterestArticlesLoaded(true);
        }
      }
    }

    void loadInterestArticles();

    return () => {
      ignore = true;
    };
  }, [cartArticleIds, currentStepKey, items.length]);

  useEffect(() => {
    if (currentStepKey !== "envio") return;
    void refreshLookups?.();
  }, [currentStepKey, refreshLookups]);

  useEffect(() => {
    if (!shippingMethodOptions.length) {
      if (shippingMethodId) setShippingMethodId("");
      return;
    }

    if (
      !shippingMethodId ||
      !shippingMethodOptions.some(
        (item) => Number(item.id) === Number(shippingMethodId),
      )
    ) {
      setShippingMethodId(shippingMethodOptions[0].id);
    }
  }, [shippingMethodId, shippingMethodOptions]);

  useEffect(() => {
    if (!paymentMethodOptions.length) {
      if (paymentMethod) setPaymentMethod("");
      return;
    }

    if (
      !paymentMethod ||
      !paymentMethodOptions.some((item) => item.id === paymentMethod)
    ) {
      setPaymentMethod(paymentMethodOptions[0].id);
    }
  }, [paymentMethod, paymentMethodOptions]);

  const selectedShippingMethod = useMemo(
    () =>
      shippingMethodId
        ? shippingMethodOptions.find(
            (item) => Number(item.id) === Number(shippingMethodId),
          ) || null
        : null,
    [shippingMethodId, shippingMethodOptions],
  );
  const shipping = selectedShippingMethod || shippingMethodOptions[0] || null;

  const payment =
    paymentMethodOptions.find((item) => item.id === paymentMethod) ||
    paymentMethodOptions[0] ||
    null;
  const isBankTransferPayment = payment?.id === "BANK_TRANSFER";
  const unavailableItems = useMemo(
    () => items.filter((item) => isCheckoutItemUnavailable(item)),
    [items],
  );
  const hasUnavailableItems = unavailableItems.length > 0;
  const unavailableItemsCount = unavailableItems.length;
  const unavailableTickerLabel =
    unavailableItemsCount === 1
      ? "1 artículo no disponible"
      : `${unavailableItemsCount} artículos no disponibles`;
  const availableItems = useMemo(
    () => items.filter((item) => !isCheckoutItemUnavailable(item)),
    [items],
  );
  const visibleInterestArticles = useMemo(
    () =>
      interestArticles.filter(
        (article) => !cartArticleIds.has(Number(article.id)),
      ),
    [cartArticleIds, interestArticles],
  );
  const packageWeightKg = useMemo(
    () =>
      Number(
        availableItems
          .reduce(
            (sum, item) =>
              sum + Number(item.weightKg || 0) * Number(item.quantity || 0),
            0,
          )
          .toFixed(3),
      ),
    [availableItems],
  );
  const hasItemsWithoutWeight = useMemo(
    () => availableItems.some((item) => Number(item.weightKg || 0) <= 0),
    [availableItems],
  );
  const shippingQuote = useMemo(
    () =>
      shipping
        ? calculateShippingCost(shipping, packageWeightKg)
        : { cost: 0, rate: null, isUnavailable: false },
    [shipping, packageWeightKg],
  );
  const selectedOfficialRatesHref = useMemo(
    () => getOfficialRatesHref(selectedShippingMethod),
    [selectedShippingMethod],
  );
  const selectedOfficialRatesLabel = useMemo(
    () => getOfficialRatesLabel(selectedShippingMethod),
    [selectedShippingMethod],
  );
  const subtotal = availableItems.reduce(
    (sum, item) =>
      sum + Number(item.lineTotal ?? item.discountedPrice * item.quantity),
    0,
  );
  const estimatedShippingCost = shippingQuote.isUnavailable
    ? null
    : Number(shippingQuote.cost || 0);
  const total = subtotal + Number(estimatedShippingCost || 0);
  const shippingUnavailableMessage =
    shipping && shippingQuote.isUnavailable
      ? `El método seleccionado no tiene tarifa configurada para ${formatWeightKg(packageWeightKg)}. Elegí otro método o contactá a ESADAR para coordinar el envío.`
      : "";

  const buyerComplete = isAuthenticated || !getGuestBuyerValidationMessage();
  const paymentComplete = Boolean(
    paymentMethod &&
    paymentMethodOptions.some((item) => item.id === paymentMethod),
  );
  const shippingComplete = Boolean(
    shippingMethodId &&
    shippingMethodOptions.some(
      (item) => Number(item.id) === Number(shippingMethodId),
    ) &&
    !shippingQuote.isUnavailable,
  );

  const checkoutCanAdvanceFromSummary =
    availableItems.length > 0 && !hasUnavailableItems;

  const completion = {
    resumen: checkoutCanAdvanceFromSummary,
    comprador: buyerComplete,
    pago: paymentComplete,
    envio: shippingComplete,
    confirmacion:
      checkoutCanAdvanceFromSummary &&
      buyerComplete &&
      paymentComplete &&
      shippingComplete,
  };

  const maxAllowedStepIndex = useMemo(() => {
    let allowed = 0;
    if (!completion.resumen) return 0;
    allowed = 1;
    if (!completion.comprador) return allowed;
    allowed = 2;
    if (!completion.pago) return allowed;
    allowed = 3;
    if (!completion.envio) return allowed;
    return 4;
  }, [completion]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ guest, shippingMethodId, paymentMethod, notes }),
    );
  }, [guest, shippingMethodId, paymentMethod, notes]);

  useEffect(() => {
    if (
      (!availableItems.length || hasUnavailableItems) &&
      currentStepKey !== "resumen"
    ) {
      navigate("/checkout/resumen", { replace: true });
      return;
    }

    if (currentStepIndex > maxAllowedStepIndex) {
      navigate(`/checkout/${steps[maxAllowedStepIndex].key}`, {
        replace: true,
      });
    }
  }, [
    availableItems.length,
    currentStepIndex,
    currentStepKey,
    hasUnavailableItems,
    maxAllowedStepIndex,
    navigate,
  ]);

  function getGuestBuyerValidationIssue() {
    const checks = [
      {
        target: "checkout-guest-first-name",
        message: getRequiredValidationMessage(
          guest.firstName,
          "el nombre del comprador",
        ),
      },
      {
        target: "checkout-guest-last-name",
        message: getRequiredValidationMessage(
          guest.lastName,
          "el apellido del comprador",
        ),
      },
      {
        target: "checkout-guest-birth-date",
        message: getRequiredValidationMessage(
          guest.birthDate,
          "la fecha de nacimiento",
        ),
      },
      {
        target: "checkout-guest-phone",
        message: getRequiredValidationMessage(guest.phone, "el teléfono"),
      },
      {
        target: "checkout-guest-address",
        message: getRequiredValidationMessage(guest.address, "la dirección"),
      },
      {
        target: "checkout-guest-email",
        message: getRequiredValidationMessage(guest.email, "el email"),
      },
      {
        target: "checkout-guest-email",
        message: getEmailValidationMessage(guest.email),
      },
    ];

    return checks.find((check) => Boolean(check.message)) || null;
  }

  function getGuestBuyerValidationMessage() {
    return getGuestBuyerValidationIssue()?.message || "";
  }

  function scrollCheckoutStepTop({ behavior = "smooth" } = {}) {
    if (typeof window === "undefined") return;

    // En checkout el enmarque correcto es el shell completo del proceso:
    // titulo, pasos, contenido activo y controles. Usar solo el contenido del
    // paso corta el contexto visual y hace que el wizard parezca irse al top.
    const target = checkoutShellRef.current || checkoutStepContentRef.current;
    if (!target) return;

    scrollElementIntoViewWithSiteChromeOffset(target, {
      behavior,
      includeTicker: true,
      extra: 14,
    });
    checkoutStepContentRef.current?.focus?.({ preventScroll: true });
  }

  function scheduleCheckoutStepScroll(options = {}) {
    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(() => scrollCheckoutStepTop(options), 0);
        });
      });
    });
  }

  function goToStep(index) {
    if (index > maxAllowedStepIndex) return;
    navigate(`/checkout/${steps[index].key}`, {
      state: { preserveScroll: true, source: "checkout-wizard" },
    });
    if (index !== currentStepIndex) scheduleCheckoutStepScroll();
  }

  function showCheckoutMessage(type, message, options = {}) {
    if (type === "error") {
      setError(message);
    } else {
      setSuccess(message);
    }
    notifyFormStatus(notifyMobileStatus, type, message, options);
  }

  function handleRemoveCartItem(lineKey) {
    removeItem(lineKey);
    setError("");
    notifyFormStatus(notifyMobileStatus, "success", "Artículo removido");
  }

  function validateCurrentStep() {
    setError("");

    if (currentStepKey === "resumen" && !availableItems.length) {
      showCheckoutMessage("error", "Tu carrito está vacío.");
      return false;
    }

    if (hasUnavailableItems) {
      showCheckoutMessage(
        "error",
        "Para avanzar, primero quitá todos los artículos no disponibles del carrito.",
      );
      return false;
    }

    if (currentStepKey === "comprador" && !isAuthenticated) {
      const validationIssue = getGuestBuyerValidationIssue();
      if (validationIssue) {
        showCheckoutMessage("error", validationIssue.message, {
          target: validationIssue.target,
        });
        return false;
      }
    }

    if (currentStepKey === "pago" && !paymentComplete) {
      if (!paymentMethodOptions.length) {
        showCheckoutMessage(
          "error",
          "No hay medios de pago disponibles en este momento. Contacta a ESADAR para completar la compra.",
        );
        return false;
      }
      showCheckoutMessage(
        "error",
        "Selecciona un medio de pago para continuar.",
      );
      return false;
    }

    if (currentStepKey === "envio" && !shippingComplete) {
      if (!shippingMethodOptions.length) {
        showCheckoutMessage(
          "error",
          "No hay métodos de envío disponibles en este momento. Contacta a ESADAR para coordinar la entrega.",
        );
        return false;
      }
      if (shippingQuote.isUnavailable && shippingUnavailableMessage) {
        showCheckoutMessage("error", shippingUnavailableMessage);
        return false;
      }
      showCheckoutMessage(
        "error",
        "Selecciona un método de envío para continuar.",
      );
      return false;
    }

    return true;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1);
    navigate(`/checkout/${steps[nextIndex].key}`, {
      state: { preserveScroll: true, source: "checkout-wizard" },
    });
    if (nextIndex !== currentStepIndex) scheduleCheckoutStepScroll();
  }

  function handleBack() {
    const previousIndex = Math.max(currentStepIndex - 1, 0);
    navigate(`/checkout/${steps[previousIndex].key}`, {
      state: { preserveScroll: true, source: "checkout-wizard" },
    });
    if (previousIndex !== currentStepIndex) scheduleCheckoutStepScroll();
  }

  async function handleConfirmOrder() {
    if (hasUnavailableItems) {
      showCheckoutMessage(
        "error",
        "Para confirmar la orden, primero quitá todos los artículos no disponibles del carrito.",
      );
      return;
    }

    if (!completion.confirmacion || !availableItems.length) {
      showCheckoutMessage(
        "error",
        "Completa los pasos previos antes de confirmar la orden.",
      );
      return;
    }

    if (!isAuthenticated) {
      const validationIssue = getGuestBuyerValidationIssue();
      if (validationIssue) {
        showCheckoutMessage("error", validationIssue.message, {
          target: validationIssue.target,
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (isAuthenticated) {
        await flushCartSync();
      }

      const payload = {
        shippingMethodId: Number(shippingMethodId),
        paymentMethod,
        notes: notes || null,
        items: availableItems.map((item) => ({
          articleId: item.articleId,
          quantity: item.quantity,
          acceptedOfferId: item.acceptedOffer?.id || null,
        })),
      };

      if (!isAuthenticated) {
        payload.guest = {
          ...guest,
          birthDate: guest.birthDate,
          email: guest.email,
          address: guest.address,
          phone: guest.phone,
          instagram: guest.instagram || null,
        };
      }

      const response = await apiFetch("/api/public/orders", {
        method: "POST",
        body: payload,
      });

      const createdOrder = response?.order || null;
      const orderNumber = createdOrder?.orderNumber;
      if (!orderNumber) {
        throw new Error(
          "La orden fue creada, pero no se pudo obtener el número de confirmación.",
        );
      }

      const completionPayload = {
        orderNumber,
        orderId: createdOrder?.id || null,
        total: createdOrder?.total ?? total,
        paymentMethod: createdOrder?.paymentMethod || paymentMethod,
        paymentInstructions: createdOrder?.paymentInstructions || null,
      };

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          COMPLETE_STORAGE_KEY,
          JSON.stringify(completionPayload),
        );
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("esadar:suppress-footer-reveal", {
            detail: { duration: 1600 },
          }),
        );
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }

      navigate("/checkout/completa", {
        replace: true,
        state: completionPayload,
      });
    } catch (err) {
      showCheckoutMessage(
        "error",
        getFriendlyErrorMessage(err, "No se pudo crear la orden."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function showStockNotice(result) {
    if (!result || result.ok) return;

    const nextDialog =
      result.code === "OUT_OF_STOCK"
        ? {
            title: "Sin stock disponible",
            message: "Esta prenda ya no tiene unidades disponibles.",
          }
        : {
            title: "Cantidad máxima disponible",
            message: `Solo puedes comprar ${result.maxQuantity} unidad${result.maxQuantity === 1 ? "" : "es"} de esta prenda.`,
          };

    notifyError(nextDialog.message);
  }

  function renderInterestFallbackSection() {
    return <LeadCaptureCta className="checkout-interest-fallback-section" />;
  }

  function renderInterestArticlesSection() {
    if (!interestArticlesLoaded) return null;

    if (!visibleInterestArticles.length) {
      return renderInterestFallbackSection();
    }

    return (
      <section className="page-stack article-related-scroll-section checkout-interest-scroll-section">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">¡Ey!</p>
            <h2>También podría interesarte</h2>
          </div>
          <ScrollRailControls
            targetRef={checkoutInterestTrackRef}
            className="scroll-rail-controls--left"
          />
        </div>

        <div
          ref={checkoutInterestTrackRef}
          className="related-articles-track article-horizontal-card-track"
        >
          {visibleInterestArticles.map((article) => (
            <div key={article.id} className="related-articles-track__item">
              <ArticleCard article={article} view="grid" variant="default" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderSummaryStep() {
    return (
      <>
        <div className="checkout-step-grid">
          <div className="checkout-items-block section-card nested-card">
            <div className="section-heading compact-heading">
              <div>
                <p className="section-kicker">Resumen</p>
                {/* <h2>Resumen</h2> */}
              </div>
            </div>

            {isMobileSummary ? (
              <div
                className="summary-item-card-list"
                aria-label="Prendas de la orden"
              >
                {items.map((item) => {
                  const isUnavailable = isCheckoutItemUnavailable(item);
                  return (
                    <SummaryItemCard
                      key={getCheckoutLineKey(item)}
                      item={item}
                      isUnavailable={isUnavailable}
                      onRemove={handleRemoveCartItem}
                      onQuantityChange={(articleId, quantity) => {
                        if (isUnavailable) return;
                        const result = updateQuantity(articleId, quantity);
                        showStockNotice(result);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="table-shell checkout-items-table-shell">
                <table className="data-table checkout-items-table">
                  <thead>
                    <tr>
                      <th>Img</th>
                      <th>Prenda</th>
                      <th>Marca</th>
                      <th>Talle</th>
                      <th>Cant.</th>
                      <th>Unitario</th>
                      <th>Total</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const isUnavailable = isCheckoutItemUnavailable(item);
                      const detailPath = articlePath(item, item.articleId);
                      const rowClassName = [
                        item.acceptedOffer ? "checkout-offer-row" : "",
                        isUnavailable ? "checkout-unavailable-row" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <tr
                          key={getCheckoutLineKey(item)}
                          className={rowClassName || undefined}
                        >
                          <td>
                            <Link
                              to={detailPath}
                              className="table-thumb-link"
                              aria-label={`Ver prenda ${item.title}`}
                            >
                              <SmartImage
                                src={item.image}
                                alt={item.title}
                                fallbackLabel={item.title}
                                className="table-thumb-image"
                              />
                            </Link>
                          </td>
                          <td className="cell-truncate">
                            <Link
                              to={detailPath}
                              className="table-strong-link"
                              aria-label={`Ver prenda ${item.title}`}
                              title={item.title}
                            >
                              {item.title}
                            </Link>
                          </td>
                          <td className="cell-truncate">
                            {item.brandName || "Sin marca"}
                          </td>
                          <td className="cell-truncate">
                            {item.sizeLabel || "Sin talle"}
                          </td>
                          <td>
                            {isUnavailable ? (
                              <span className="status-badge status-unavailable">
                                No disponible
                              </span>
                            ) : (
                              <input
                                className="input input-small checkout-qty-input"
                                type="number"
                                min="1"
                                max={item.maxQuantity || item.quantity}
                                value={item.quantity}
                                aria-label={`Cantidad de ${item.title}`}
                                onChange={(event) => {
                                  const result = updateQuantity(
                                    getCheckoutLineKey(item),
                                    Number(event.target.value || 1),
                                  );
                                  showStockNotice(result);
                                }}
                              />
                            )}
                          </td>
                          <td>
                            {item.acceptedOffer ? (
                              <span className="checkout-offer-price">
                                <span className="pill pill-offer">
                                  Oferta aceptada
                                </span>
                                <span className="price-old">
                                  {formatCurrency(item.salePrice)}
                                </span>
                                <strong>
                                  {formatCurrency(item.acceptedOffer.price)}
                                </strong>
                                <small className="muted-copy">
                                  Aplica a 1 unidad · ahorro{" "}
                                  {formatCurrency(getOfferSavings(item))}
                                </small>
                              </span>
                            ) : (
                              <span className="checkout-regular-price">
                                {/* <span className="muted-copy">Precio normal</span> */}
                                <strong>
                                  {formatCurrency(item.discountedPrice)}
                                </strong>
                              </span>
                            )}
                          </td>
                          <td>
                            {isUnavailable ? (
                              <span className="muted-copy">
                                Fuera del total
                              </span>
                            ) : (
                              <strong>
                                {formatCurrency(
                                  item.lineTotal ??
                                    item.discountedPrice * item.quantity,
                                )}
                              </strong>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-action-button"
                              onClick={() =>
                                handleRemoveCartItem(getCheckoutLineKey(item))
                              }
                              aria-label={`Quitar ${item.title}`}
                              title="Quitar"
                            >
                              <TrashIcon />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="checkout-side-summary section-card nested-card">
            <p className="section-kicker">Totales</p>
            <div className="order-summary-card checkout-summary-plain">
              <p className="summary-line">
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </p>
              <p className="summary-line">
                <span>Peso aprox.</span>
                <strong>{formatWeightKg(packageWeightKg)}</strong>
              </p>
              <p className="summary-line">
                <span>Envío estimado</span>
                <strong>
                  {shippingQuote.isUnavailable
                    ? "Sin tarifa"
                    : formatCurrency(estimatedShippingCost)}
                </strong>
              </p>
              <p className="summary-line total">
                <span>Total estimado</span>
                <strong>{formatCurrency(total)}</strong>
              </p>
            </div>
          </aside>
        </div>
      </>
    );
  }

  function renderBuyerStep() {
    if (isAuthenticated) {
      return (
        <div className="section-card nested-card">
          <p className="section-kicker">Comprador autenticado</p>
          <h2>
            {user.firstName} {user.lastName}
          </h2>
          <div className="detail-meta-list checkout-meta-list">
            <div>
              <span>Email</span>
              <strong>{user.email || "Sin email"}</strong>
            </div>
            <div>
              <span>Teléfono</span>
              <strong>{user.phone || "Sin teléfono"}</strong>
            </div>
            <div>
              <span>Instagram</span>
              <strong>{user.instagram || "Sin Instagram"}</strong>
            </div>
          </div>
          <p className="muted-copy">La orden se generará con esta cuenta.</p>
        </div>
      );
    }

    return (
      <div className="section-card nested-card">
        <p className="section-kicker">Datos del comprador</p>
        <div className="form-grid-two">
          <label className="field-group">
            <span>Nombre</span>
            <input
              className="input"
              name="firstName"
              data-validation-field="checkout-guest-first-name"
              value={guest.firstName}
              onChange={(event) =>
                setGuest((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="field-group">
            <span>Apellido</span>
            <input
              className="input"
              name="lastName"
              data-validation-field="checkout-guest-last-name"
              value={guest.lastName}
              onChange={(event) =>
                setGuest((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="field-group">
            <span>Fecha de nacimiento</span>
            <input
              className="input"
              type="date"
              name="birthDate"
              data-validation-field="checkout-guest-birth-date"
              value={guest.birthDate}
              onChange={(event) =>
                setGuest((current) => ({
                  ...current,
                  birthDate: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="field-group">
            <span>Teléfono</span>
            <input
              className="input"
              name="phone"
              data-validation-field="checkout-guest-phone"
              value={guest.phone}
              onChange={(event) =>
                setGuest((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="field-group form-grid-span-two">
            <span>Dirección</span>
            <input
              className="input"
              name="address"
              data-validation-field="checkout-guest-address"
              value={guest.address}
              onChange={(event) =>
                setGuest((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="field-group">
            <span>Instagram</span>
            <input
              className="input"
              name="instagram"
              value={guest.instagram}
              onChange={(event) =>
                setGuest((current) => ({
                  ...current,
                  instagram: event.target.value,
                }))
              }
            />
          </label>
          <label className="field-group">
            <span>Email</span>
            <input
              className="input"
              type="email"
              name="email"
              data-validation-field="checkout-guest-email"
              value={guest.email}
              onChange={(event) =>
                setGuest((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              required
            />
          </label>
        </div>
        <p className="muted-copy">
          Puedes comprar sin usuario o <Link to="/login">ingresar</Link> para
          usar tu cuenta.
        </p>
      </div>
    );
  }

  function renderPaymentStep() {
    return (
      <div className="section-card nested-card">
        <p className="section-kicker">Medio seleccionado</p>
        {lookupError ? <p className="muted-copy">{lookupError}</p> : null}
        {lookupsLoaded && !paymentMethodOptions.length ? (
          <p className="error-copy">
            No hay medios de pago disponibles en este momento.
          </p>
        ) : null}
        <div className="stack-gap-sm">
          {paymentMethodOptions.map((option) => (
            <label key={option.id} className="radio-card radio-card-plain">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === option.id}
                onChange={() => setPaymentMethod(option.id)}
              />
              <div>
                <strong>{option.label}</strong>
                <p>{option.instructions}</p>
              </div>
            </label>
          ))}
        </div>
        <label className="field-group checkout-notes">
          <span>Notas</span>
          <textarea
            className="input textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>
    );
  }

  function renderShippingStep() {
    return (
      <div className="section-card nested-card">
        <p className="section-kicker">Envío</p>
        {lookupError ? <p className="muted-copy">{lookupError}</p> : null}
        {lookupsLoaded && !shippingMethodOptions.length ? (
          <p className="error-copy">
            No hay métodos de envío disponibles en este momento.
          </p>
        ) : null}
        <div className="checkout-shipping-summary-card">
          <div className="checkout-shipping-summary-main">
            <span>Peso aproximado de la orden</span>
            <strong>{formatWeightKg(packageWeightKg)}</strong>
          </div>
          {hasItemsWithoutWeight ? (
            <p className="checkout-shipping-weight-warning">
              Algunos artículos no tienen peso cargado; el cálculo puede ser
              aproximado.
            </p>
          ) : null}
          {selectedOfficialRatesHref ? (
            <a
              className="ghost-button checkout-shipping-rates-link"
              href={selectedOfficialRatesHref}
              target="_blank"
              rel="noreferrer"
            >
              {selectedOfficialRatesLabel}
            </a>
          ) : null}
        </div>
        {shippingQuote.isUnavailable && shippingUnavailableMessage ? (
          <p className="error-copy checkout-shipping-rate-alert">
            {shippingUnavailableMessage}
          </p>
        ) : null}
        <div className="stack-gap-sm">
          {shippingMethodOptions.map((option) => {
            const optionQuote = calculateShippingCost(option, packageWeightKg);
            const isWeightBased = usesWeightRanges(option.pricingType);
            return (
              <label
                key={option.id}
                className={[
                  "radio-card",
                  "radio-card-plain",
                  optionQuote.isUnavailable ? "is-unavailable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  type="radio"
                  name="shippingMethodId"
                  checked={Number(shippingMethodId) === Number(option.id)}
                  onChange={() => setShippingMethodId(option.id)}
                />
                <div>
                  <strong>{option.label}</strong>
                  <p>
                    {optionQuote.isUnavailable
                      ? "Sin tarifa para este peso"
                      : formatCurrency(optionQuote.cost)}
                  </p>
                  {isWeightBased && optionQuote.rate ? (
                    <p className="muted-copy">
                      Rango aplicado:{" "}
                      {optionQuote.rate.label ||
                        `${formatWeightKg(optionQuote.rate.minWeightKg)} a ${formatWeightKg(optionQuote.rate.maxWeightKg)}`}
                    </p>
                  ) : null}
                  <p className="muted-copy">{option.instructions}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  function renderConfirmationStep() {
    return (
      <div className="checkout-confirmation-grid">
        <div className="section-card nested-card checkout-confirm-panel">
          <p className="section-kicker">Confirmar órden</p>
          <div className="detail-meta-list checkout-meta-list">
            <div>
              <span>Artículos</span>
              <strong>{availableItems.length}</strong>
            </div>
            <div>
              <span>Comprador</span>
              <strong>
                {isAuthenticated
                  ? `${user.firstName} ${user.lastName}`
                  : `${guest.firstName} ${guest.lastName}`}
              </strong>
            </div>
            <div>
              <span>Medio de pago</span>
              <strong>{payment?.label}</strong>
            </div>
            <div>
              <span>Método de envío</span>
              <strong>{shipping?.label}</strong>
            </div>
            <div>
              <span>Peso aprox.</span>
              <strong>{formatWeightKg(packageWeightKg)}</strong>
            </div>
            <div>
              <span>Instrucciones de pago</span>
              <strong>{payment?.instructions}</strong>
            </div>
            <div>
              <span>Entrega</span>
              <strong>{shipping?.instructions}</strong>
            </div>
          </div>
          <p className="muted-copy">
            La reserva dura 24 horas y la orden será validada desde
            administración una vez confirmado el pago.
          </p>
          {isBankTransferPayment ? (
            <p className="inline-note payment-reference-note">
              En el motivo/concepto de la transferencia indicá el número de
              orden. Al confirmarla te mostramos el número exacto.
            </p>
          ) : null}
          <p className="muted-copy checkout-tracking-availability-copy">
            Cuando tu orden sea aprobada y despachada, te enviaremos un correo
            de notificación con la información del envío y el código de
            seguimiento, siempre que el proveedor de cadetería o correspondencia
            lo tenga disponible.
          </p>
        </div>

        <aside className="section-card nested-card checkout-confirm-summary">
          <p className="summary-line">
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </p>
          <p className="summary-line">
            <span>Envío</span>
            <strong>
              {shippingQuote.isUnavailable
                ? "Sin tarifa"
                : formatCurrency(estimatedShippingCost)}
            </strong>
          </p>
          <p className="summary-line total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </p>
          {notes ? <p className="muted-copy">Notas: {notes}</p> : null}
        </aside>
      </div>
    );
  }

  function renderCurrentStep() {
    if (currentStepKey === "comprador") return renderBuyerStep();
    if (currentStepKey === "pago") return renderPaymentStep();
    if (currentStepKey === "envio") return renderShippingStep();
    if (currentStepKey === "confirmacion") return renderConfirmationStep();
    return renderSummaryStep();
  }

  if (!items.length) {
    return (
      <div className="container">
        <div className="section-card centered-card checkout-empty-card">
          <h1>Tu carrito está vacío</h1>
          <p>Agrega prendas al carrito para iniciar el proceso de compra.</p>
          <Link className="button button-primary" to="/">
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {hasUnavailableItems ? (
        <div
          className="cart-unavailable-ticker"
          role="alert"
          aria-live="assertive"
        >
          <span className="cart-unavailable-ticker__message">
            {unavailableTickerLabel}.
          </span>
        </div>
      ) : null}

      <div className="container page-stack checkout-page-stack">
        <section ref={checkoutShellRef} className="section-card checkout-shell">
          <div className="checkout-shell-header">
            <div>
              <p className="section-kicker">
                Proceso de compra: {currentStepIndex + 1} de {steps.length}
              </p>
              <h2>Proceso de compra</h2>
            </div>
          </div>

          <div className="checkout-steps-row" aria-label="Pasos de compra">
            {steps.map((step, index) => {
              const isCurrent = index === currentStepIndex;
              const isAllowed = index <= maxAllowedStepIndex;
              const isComplete =
                completion[step.key] && index < currentStepIndex;

              return (
                <button
                  key={step.key}
                  type="button"
                  className={[
                    "checkout-step-pill",
                    isCurrent ? "is-current" : "",
                    isComplete ? "is-complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!isAllowed || submitting}
                  onClick={() => goToStep(index)}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span>{step.kicker}</span>
                  <strong>{step.label}</strong>
                </button>
              );
            })}
          </div>

          {/* <div className="checkout-steps-row checkout-steps-row--single">
            <div className="checkout-step-current-card" aria-live="polite">
              <span>{currentStep.kicker} · {currentStepIndex + 1} de {steps.length}</span>
              <strong>{currentStep.label}</strong>
            </div>
          </div> */}

          <div
            ref={checkoutStepContentRef}
            className="checkout-step-content-anchor"
            tabIndex={-1}
          >
            {renderCurrentStep()}
          </div>

          <PreviousNextControls
            className="checkout-navigation"
            previousClassName="button button-secondary"
            nextClassName="button button-primary"
            previousDisabled={currentStepIndex === 0 || submitting}
            onPrevious={handleBack}
            onNext={handleNext}
            nextSlot={
              currentStepKey === "confirmacion" ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleConfirmOrder}
                  disabled={submitting}
                >
                  {submitting ? "Creando orden…" : "Confirmar orden"}
                </button>
              ) : undefined
            }
          />
        </section>

        {currentStepKey === "resumen" ? renderInterestArticlesSection() : null}
      </div>
    </>
  );
}
