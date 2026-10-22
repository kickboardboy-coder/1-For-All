import { privacyPolicy, termsPolicy, type Policy } from '../data/policies'

const policies = {
  terms: termsPolicy,
  privacy: privacyPolicy,
} as const

type PolicyPageProps = {
  kind: keyof typeof policies
}

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
  )
}

function PolicyPage({ kind }: PolicyPageProps) {
  return <PolicyArticle policy={policies[kind]} />
}

export default PolicyPage
