import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import SmartImage from "./SmartImage.jsx";
import WishlistHeartButton from "./WishlistHeartButton.jsx";
import { useWishlist } from "../contexts/WishlistContext.jsx";
import { formatCurrency, getDiscountedPrice } from "../lib/format.js";

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

export default function FeaturedMotionCards({ title, items = [] }) {
  const shouldReduceMotion = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 961px)");
  const { isSaved, toggleItem, pendingIds } = useWishlist();
  // const featuredItems = isDesktop ? items.slice(0, 3) : items.slice(0, 4);
  const featuredItems = items;

  if (!featuredItems.length) return null;

  function renderFeaturedItem(article, index) {
    const price = getDiscountedPrice(article);
    const soldOut =
      Number(article.quantityAvailable || 0) <= 0 ||
      article.status === "SOLD_OUT";
    const saved = isSaved(article.id);
    const pending = pendingIds.includes(Number(article.id));

    const optimisticWishlistItem = {
      articleId: article.id,
      slug: article.slug,
      title: article.title,
      salePrice: article.salePrice,
      discountType: article.discountType,
      discountValue: article.discountValue,
      discountedPrice: article.discountedPrice,
      status: article.status,
      conditionLabel: article.conditionLabel,
      color: article.color,
      material: article.material,
      quantityAvailable: article.quantityAvailable,
      brandName: article.brandName,
      sizeLabel:
        article.sizeText || article.size?.code || article.sizeCode || "",
      image:
        article.primaryImage ||
        article.primaryImageThumb ||
        article.primaryImageDetail ||
        "",
      allowOffers: article.allowOffers,
    };

    return (
      <motion.div
        key={article.id}
        className={`featured-motion-card featured-motion-card--${(index % 4) + 1}`}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{
          type: "spring",
          stiffness: 180,
          damping: 24,
          delay: index * 0.04,
        }}
        whileHover={shouldReduceMotion ? undefined : { y: -8, scale: 1.01 }}
      >
        <Link
          to={`/articles/${article.slug || article.id}`}
          className="featured-motion-card__link"
        >
          <div className="featured-motion-card__media">
            <SmartImage
              src={
                article.primaryImageDetail ||
                article.primaryImageThumb ||
                article.primaryImage
              }
              alt={article.primaryImageAlt || article.title}
              fallbackLabel={article.title}
              className="featured-motion-card__image"
            />
          </div>

          <div className="featured-motion-card__overlay" />

          <div className="featured-motion-card__copy">
            <p className="section-kicker">
              {article.categoryName || article.category?.name || "Destacado"}
            </p>
            <h3>{article.title}</h3>
            <div className="featured-motion-card__meta">
              <span>
                {article.conditionLabel || "Segunda mano seleccionada"}
              </span>
              <strong>{formatCurrency(price)}</strong>
            </div>
            {soldOut ? (
              <span className="featured-motion-card__status">Agotado</span>
            ) : null}
          </div>
        </Link>

        <WishlistHeartButton
          active={saved}
          pending={pending}
          className="featured-motion-card__favorite wishlist-heart-button--bare"
          labelActive="Quitar de guardados"
          labelInactive="Guardar articulo"
          onToggle={() => void toggleItem(article, optimisticWishlistItem)}
        />
      </motion.div>
    );
  }

  if (!isDesktop) {
    return (
      <section className="featured-rail container">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Seleccion</p>
            <h2>{title}</h2>
          </div>
        </div>

        <div className="rail-scroller">
          {featuredItems.map((article, index) => (
            <div key={article.id} className="rail-item">
              {renderFeaturedItem(article, index)}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="featured-motion-shell container">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Seleccion</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="featured-motion-grid featured-motion-grid--all">
        {featuredItems.map((article, index) =>
          renderFeaturedItem(article, index),
        )}
      </div>
    </section>
  );
}
