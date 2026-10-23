import { useEffect, useLayoutEffect } from 'react';
import { privacyPolicy, termsPolicy, type Policy } from '../data/policies';

const policies = {
  terms: termsPolicy,
  privacy: privacyPolicy,
} as const;

type PolicyPageProps = {
  kind: keyof typeof policies;
};

function PolicyArticle({ policy }: { policy: Policy }) {
  return (
    <section className="policy-page">
      <p className="policy-kicker">의쉬행</p>
      <h1>{policy.title}</h1>
      <p className="policy-updated">시행일 {policy.updated}</p>
      <p className="policy-intro">{policy.intro}</p>
      {policy.sections.map((section) => (
        <article key={section.title} className="policy-section">
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      ))}
    </section>
  );
}

function scrollPolicyToNav() {
  if (!window.matchMedia('(max-width: 768px)').matches) {
    return;
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function PolicyPage({ kind }: PolicyPageProps) {
  useLayoutEffect(() => {
    scrollPolicyToNav();
  }, [kind]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(scrollPolicyToNav);
    return () => window.cancelAnimationFrame(frame);
  }, [kind]);

  return <PolicyArticle policy={policies[kind]} />;
}

export default PolicyPage;
