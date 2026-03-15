import ArticleCard from './ArticleCard.jsx';

export default function FeaturedRail({ title, items }) {
  if (!items?.length) return null;

  return (
    <section className="featured-rail">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Selección</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="rail-scroller">
        {items.map((article) => (
          <div key={article.id} className="rail-item">
            <ArticleCard article={article} />
          </div>
        ))}
      </div>
    </section>
  );
}
