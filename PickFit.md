# project.md
> SSOT for Codex and implementation planning  
> Project: 픽핏 (PickFit)  
> Type: Korean situation/body-type/budget-based fashion decision agent web app  
> Status: MVP planning document synthesized from 3 attached source texts plus conversation-confirmed brand decisions

---

## 0. How to use this document

This file is the **single source of truth** for the current product direction.

When implementing or planning:
1. Prioritize this document over fragmented chat memory.
2. Do **not** expand scope beyond the explicit MVP.
3. Treat this project as a **decision engine**, not a generic shopping app and not a generic chatbot.
4. Default to **high-trust, explainable, structured recommendation UX**.
5. Default to **web app first**, **semi-closed catalog**, **Korean market**, **20–34 early-career target**.
6. If a requirement is ambiguous, choose the interpretation that preserves:
   - faster decision-making
   - higher trust
   - structured product/review data
   - narrower MVP scope

---

## 1. Executive summary

### Product one-liner
**픽핏은 “상품을 많이 보여주는 앱”이 아니라, 사용자의 상황·취향·체형·예산을 빠르게 파악하고, 구조화된 상품/리뷰 데이터를 바탕으로 완성 코디와 추천 이유를 설명해 3분 안에 구매 결정을 끝내게 해주는 한국형 패션 결정 에이전트 웹앱이다.**

### Core reframe
This project must **not** be built as:
- generic AI shopping app
- generic fashion search app
- generic chat-based stylist
- open-web shopping agent
- community/SNS fashion feed

This project **must** be built as:
- **Korean fashion decision agent**
- **situation-first recommendation engine**
- **semi-closed, structured product catalog**
- **explainable outfit recommendation system**
- **trust-centered shopping UX**

### Why this project exists
Users are not asking for “AI that can read product pages.”  
Users are asking for:

- I do not know what to buy.
- I do not know what suits me.
- I do not want to read hundreds of reviews.
- I do not want to fail on size/fit.
- I want to decide quickly for my situation.

The user value is **not** “AI reads data well.”  
The user value is **“the app organizes my decision for me.”**

---

## 2. Source synthesis: what the 3 attached texts actually say

This section compresses the full meaning of the three source documents into a consistent product truth.

### Source 1: market/context truth
The shopping paradigm is shifting from **manual exploration** to **delegation**.
Key implications:
- Users increasingly let AI help with shopping decisions.
- AI commerce is moving from search/query support to **agentic delegation**.
- The UX battleground is moving from “pretty clickable UI” to:
  - structured product data
  - rich review context
  - trust design
  - visible reasoning
  - limitation disclosure
- AI agents read **data and review text**, not just front-end visuals.
- Trust comes from:
  - showing progress / work-in-public
  - acknowledging limitations
  - not pretending to do impossible/sensitive tasks
- Future winning commerce experiences may become:
  - more intent-based
  - less category-navigation-based
  - more recommendation-driven
  - potentially “page-less” or canvas-like

### Source 2: product definition truth
If built correctly, this should be:
- **not** a fashion product search app
- **not** a catalog-first shopping app
- **yes** a **situation-based fashion shopping agent**
- **yes** a **decision-finishing product**

Important design truths:
- Recommendation unit should be **outfit/look**, not individual item only.
- Onboarding must be short: **5–7 questions**.
- Recommendations must explain:
  - why this was recommended
  - which conditions were used
  - which review evidence matters
  - size/fit warnings
  - shipping/return conditions
- Comparison must be automated.
- Early-stage purchase assistance should stop before sensitive autonomous checkout.
- The product should rely on **structured, normalized product data**.
- MVP should use **closed or semi-closed catalog**, not open-web crawling.

### Source 3: business/investment truth
The idea is conditionally promising, but only under a strict positioning.

This project is investable **only if** it starts narrowly as:
- Korean market
- situation/body-type/budget-based
- semi-closed catalog
- outfit-based recommendations
- explanation-first
- purchase-link-out flow
- web app first

This project is **not** investable if it starts as:
- all-shopping-malls unified crawler
- auto-checkout agent
- mass-market everything app
- community/social feed
- virtual fitting-heavy product
- broad lifestyle commerce platform

The real moat is **not AI itself**.
The real moat is:
1. Korean fashion data normalization
2. decision completion
3. explainable outfit recommendation
4. body-type / fit failure reduction
5. Korean situation semantics
6. taste memory accumulation over time

---

## 3. Non-negotiable product thesis

### Primary thesis
**픽핏 should help users finish a fashion decision, not browse endlessly.**

### Secondary thesis
**Trust is a product feature, not a design afterthought.**

### Tertiary thesis
**Structured product and review data are first-class product assets.**

### Product stance
- We are not building a “better search box.”
- We are not building “AI for AI’s sake.”
- We are building a **high-trust decision engine for Korean fashion purchase scenarios**.

---

## 4. Product definition

## Final product definition
**한국형 상황·체형·예산 기반 패션 결정 에이전트**

Expanded:
**몇 가지 질문만으로 사용자의 상황, 취향, 체형 고민, 예산을 파악하고, 정규화된 상품·리뷰 데이터를 바탕으로 완성 코디 3개와 대안 상품을 이유까지 설명해 3분 안에 구매 결정을 끝내게 해주는 웹앱**

### Category
- Fashion commerce decision agent
- AI-assisted outfit recommendation
- Structured recommendation web app
- Korean shopping decision support

### What users should say
- “여기서 바로 결정이 된다.”
- “내 취향을 꽤 잘 이해한다.”
- “리뷰를 내가 다 안 읽어도 된다.”
- “사이즈 실패를 줄여준다.”
- “상품을 많이 보여주는 게 아니라, 고르기 쉽게 만들어준다.”

---

## 5. Target user

## Primary target
**Korean users aged 20–34, mobile shopping-familiar, especially early-career workers, who want fashion items but find choosing exhausting and slow.**

### Why this target first
- strong recurring situations
- repeated purchase contexts
- practical need over pure fashion fandom
- enough willingness to shop
- enough frustration with choice overload
- enough need for speed and confidence

### Representative situations
- first office look
- daily office look
- date look
- wedding guest look
- rainy commute look
- body-type compensating basics
- under-100,000 KRW black outfit
- travel capsule outfit
- interview / formal smart-casual
- seasonal outerwear decision

### Representative JTBD
“I do not want to browse fashion. I want to confidently decide what to wear/buy for my situation.”

### Pain points
- too many items
- too many reviews
- hard to articulate taste
- hard to compare options
- hard to imagine full outfit
- hard to predict fit failure
- hard to know what is worth the money
- hard to translate situation into actual purchase

---

## 6. Target outcome

### MVP success outcome
A user should be able to:
1. answer a small number of questions
2. receive 3 outfit recommendations
3. understand *why* they were recommended
4. compare practical differences
5. choose one direction quickly
6. click through to purchase without feeling blind

### MVP validation question
**Can users reach a satisfying purchase-ready shortlist within 3 minutes?**

---

## 7. Positioning

## What we are not
- not Musinsa/29CM replacement
- not Amazon/Perplexity open-web agent clone
- not Pinterest-style inspiration feed
- not Whering/Indyx wardrobe-first app
- not brand-owned stylist inside one retailer
- not generic AI chatbot for fashion
- not social fashion content platform

## What we are
**A Korean multi-brand outfit decision engine specialized for real purchase situations.**

### Sharp positioning line
**브랜드 안의 AI도 아니고, 범용 웹 에이전트도 아니고, 한국 패션 구매 결정에 특화된 멀티브랜드 코디 결정 엔진**

### Core differentiation
1. Korean fashion data normalization
2. outfit-first instead of item-first
3. explanation-first instead of chat-first
4. body-type and fit risk reduction
5. Korean situation semantics
6. semi-closed high-trust catalog
7. decision completion instead of browsing

---

## 8. Why this can win, and why it can fail

## Why it can win
- strong user pain: decision fatigue
- AI shopping trend is real
- many existing products cover fragments, not the full “decision completion” flow
- Korean fashion data quality is inconsistent, creating normalization opportunity
- high-value experience = fewer bad purchases + faster decisions
- trust-centered recommendation is still underbuilt

## Why it can fail
- competing too broadly with large commerce/search platforms
- poor structured data → weak recommendations
- generic recommendations without taste memory
- overbuilding chat instead of recommendation cards
- trying open-web aggregation too early
- weak trust UX
- trying autonomous checkout too early
- performance marketing dependence without structural retention

---

## 9. Business reality / investment stance

## Investable version
This is conditionally investable if it is:
- web app first
- narrow target first
- situation-based first
- semi-closed catalog
- outfit recommendation focused
- explanation-rich
- purchase link-out
- structured data moat
- not dependent on paid acquisition only

## Non-investable version
Do not build:
- full-market unified crawler
- auto checkout with payment entry
- app-first broad launch
- all genders/all categories/all age groups at once
- virtual fitting heavy-first product
- community/SNS feed
- broad lifestyle super-app

### Business stance
This is promising **not because the market is empty**, but because the market is moving in this direction and there is still room for a narrower, higher-trust execution.

---

## 10. Product principles

### Principle 1. Decision over discovery
Every screen should reduce decision load.

### Principle 2. Outfit over item
Default recommendation unit is a coordinated look.

### Principle 3. Explainability over black box
Recommendations must show reasons and evidence.

### Principle 4. Trust over automation theater
Show progress, disclose limits, never fake certainty.

### Principle 5. Structured data over visual scraping fantasy
Internal product/review normalization is a core product asset.

### Principle 6. Semi-closed catalog before open web
Accuracy first, breadth later.

### Principle 7. Fast onboarding, deep output
Ask little, infer enough, explain clearly.

### Principle 8. Risk reduction matters
Fit/size/shipping/returns are part of recommendation quality.

### Principle 9. Taste memory compounds value
Feedback should improve future recommendations.

### Principle 10. MVP must stay narrow
A small sharp blade beats a giant dull knife.

---

## 11. Core UX philosophy

### The UX shift this project should embody
Classic commerce UX optimized:
- clicking
- finding
- filtering
- navigating pages

픽핏 should optimize:
- delegation
- trust
- explanation
- comparison
- decision confidence

### Trust design requirements
Must include:
- visible condition summary
- “what was considered” section
- “what was excluded” section
- recommendation reasons
- review evidence summary
- fit/size warnings
- shipping/return clarity
- progress state during generation
- clear acknowledgment when data is missing or uncertain

### Required trust patterns
1. **Work-in-public state**
   - “Looking at fit reviews…”
   - “Comparing return policies…”
   - “Filtering by budget and silhouette…”

2. **Limitation acknowledgment**
   - “Exact fit is uncertain because body-type-specific reviews are limited.”
   - “Return fee differs by seller; latest fee should be checked at seller page.”
   - “Color may vary due to seller photos and lighting.”

3. **Decision support framing**
   - “Best for office neatness”
   - “Best for body-type compensation”
   - “Best value under budget”
   - “Lowest fit-risk option”

---

## 12. Core user journey

## Ideal short-form journey
1. User enters the app.
2. User selects a situation or writes a short intent.
3. User answers 5–7 quick onboarding questions.
4. System generates 3 outfit recommendations.
5. User sees:
   - why each outfit fits
   - what evidence supports it
   - what risks exist
6. User compares alternatives.
7. User gives feedback or clicks out to purchase.
8. System stores preference signals for next time.

## Example user input
- “다음 주 출근룩 3세트 추천해줘”
- “상체가 부해 보이지 않는 셔츠 찾아줘”
- “10만 원 이하 소개팅룩”
- “검정 슬랙스에 어울리는 신발까지”
- “장마철 출근룩”

---

## 13. MVP scope

## MVP name
**상황 기반 패션 결정 에이전트 웹앱**

## MVP goal
Validate whether users can reach a satisfying shortlist and purchase-ready decision within 3 minutes.

## Must-have MVP features
1. 5–7 question onboarding
2. mixed conversational intent + selectable filters
3. semi-closed normalized catalog
4. 3 outfit recommendations
5. item alternatives within each outfit
6. review summary
7. fit/size warnings
8. comparison table
9. recommendation reason explanation
10. save / like / dislike feedback
11. purchase link-out
12. visible conditions and trust signals

## Must-not-build in MVP
- autonomous checkout
- payment input handling
- open-web crawling
- broad category expansion
- social feed
- community
- advanced virtual fitting
- return/exchange agent automation
- wardrobe management
- voice commerce
- all-purpose chatbot

---

## 14. Onboarding requirements

## Goal
Capture the minimum set of constraints required to produce high-confidence outfit recommendations.

## Recommended onboarding question set
Keep to 5–7 questions.

### Required dimensions
1. **Situation**
   - office
   - daily
   - date
   - travel
   - wedding guest
   - interview
   - rainy day
   - exercise / athleisure
   - other

2. **Budget**
   - free input or ranges
   - e.g. under 50k / 50k–100k / 100k–200k / 200k+

3. **Style / mood**
   - minimal
   - casual
   - street
   - classic
   - feminine
   - clean
   - soft
   - chic
   - other

4. **Preferred fit**
   - slim
   - regular
   - oversized
   - relaxed
   - straight
   - body-shape compensation focus

5. **Body-type concern**
   - broad shoulders
   - upper body volume
   - lower body volume
   - height concern
   - waist definition
   - leg length proportion
   - etc.

6. **Colors often worn / preferred**
   - black
   - navy
   - gray
   - white
   - beige
   - muted
   - bright
   - etc.

7. **Avoidances**
   - no tight fit
   - no bright colors
   - no short length
   - no dry-clean-only
   - no high return risk
   - etc.

### Optional future dimensions
- gender expression preference
- brand familiarity
- material sensitivity
- season/climate
- dress-code strictness

---

## 15. Recommendation output requirements

## Recommendation unit
**Outfit/look**, not just individual item.

### For each recommended outfit, include:
- outfit title
- brief summary
- intended use case
- included item slots:
  - top
  - bottom
  - outer or shoes
  - optional accessory later
- 1–2 alternatives per slot where useful
- total estimated price range
- style tags
- body-type notes
- why this outfit fits the user
- key review evidence
- risk warnings
- purchase links

### Example outfit framing
- Office neat core
- Weekend casual comfort
- Body-shape balancing look
- Best value under budget
- Clean monochrome option

### Explanation block per outfit
At minimum answer:
1. Why this outfit was recommended
2. Which user conditions were reflected
3. Which reviews/data points support it
4. What the fit or purchase risks are

---

## 16. Comparison requirements

Comparison is a key product feature, not a secondary utility.

## Comparison types
### A. Similar item comparison
Compare 3 alternatives for a slot.

### B. Outfit comparison
Compare 3 recommended full looks.

## Required comparison dimensions
- price
- material
- fit
- thickness
- opacity
- stretch
- seasonality
- style mood
- body-type suitability
- shipping
- return policy
- review summary
- fit-risk level

## Comparison UX principle
Users should not need to open 5 tabs to understand practical differences.

---

## 17. Review intelligence requirements

## Review summary should not be simple sentiment average
It must synthesize:
- fit
- material feel
- opacity
- thickness
- seasonality
- body-type-specific comments
- satisfaction reasons
- dissatisfaction reasons
- size runs small/true/large
- color fidelity
- use-case notes

## Review output examples
- “Upper-body volume concerns mentioned by users were lower than average for this shirt due to straight silhouette and moderate shoulder structure.”
- “Most complaints focus on sleeve length rather than body width.”
- “Material is praised for non-sheer wearability but some users report low breathability in summer.”

## Review risk flags
- inconsistent sizing
- high return mentions
- color mismatch complaints
- transparency complaints
- pilling/fabric complaints
- washing durability complaints

---

## 18. Data strategy: this is the moat

## Core stance
The app’s internal advantage is **not just model quality**.  
The durable advantage is **normalized, machine-readable Korean fashion product and review data.**

## Why this matters
AI agents do not magically solve weak source data.
If product pages, options, reviews, returns, and sizing are inconsistent, recommendation quality collapses.

## Therefore
The project must prioritize a strong internal product schema and review schema.

---

## 19. Product data schema (minimum normalized schema)

## 19.1 Product base fields
- product_id
- brand_id
- brand_name
- seller_id
- seller_name
- category_main
- category_sub
- gender_target
- product_name
- hero_image_url
- product_page_url
- price_original
- price_sale
- discount_rate
- stock_status
- currency
- last_synced_at

## 19.2 Fashion-specific fields
- fit_type (slim / regular / oversized / etc.)
- silhouette
- material_main
- material_sub
- thickness
- opacity
- stretch
- seasonality
- color_family
- style_tags
- occasion_tags
- length
- rise
- shoulder_structure
- neckline
- sleeve_type
- closure_type
- model_info
- recommended_temperature_range (optional later)

## 19.3 Variant fields
- variant_id
- color_name
- color_code_normalized
- size_label
- size_system
- stock_by_variant
- variant_url
- variant_image_url

## 19.4 Purchase condition fields
- shipping_fee
- free_shipping_threshold
- estimated_shipping_days
- domestic_or_overseas
- returnable
- return_fee
- exchange_fee
- policy_note
- seller_rating (optional)

## 19.5 Merchant / trust fields
- seller_type
- official_brand_store
- marketplace_or_direct
- authenticity_signal (optional if applicable)
- policy_last_checked_at

---

## 20. Review schema (minimum normalized schema)

## 20.1 Review base
- review_id
- product_id
- rating
- review_text
- created_at
- verified_purchase (if available)

## 20.2 Structured body/profile context
- reviewer_height
- reviewer_weight
- reviewer_body_shape_tags
- usual_size
- purchased_size

## 20.3 Fit interpretation fields
- size_runs (small / true / large)
- fit_satisfaction
- material_satisfaction
- opacity_feedback
- thickness_feedback
- stretch_feedback
- color_match_feedback
- use_case_tags
- complaint_tags
- praise_tags

## 20.4 Extracted AI summary fields
- fit_summary
- material_summary
- seasonality_summary
- body_type_notes
- risk_flags
- overall_recommendation_confidence

---

## 21. Catalog strategy

## MVP catalog approach
Use **closed or semi-closed catalog**, not open-web full crawl.

### Allowed early catalog sources
- partner sellers
- selected brands
- internal normalized DB
- structured import templates

### Why
Open-web breadth too early introduces:
- inconsistent quality
- inconsistent option naming
- unstable prices
- mismatched policy fields
- unreliable stock freshness
- weak recommendation confidence

### Recommended MVP scale
- 5–10 brands
- 150–300 SKUs
- focus on tops / bottoms / outer / shoes
- enough variety for outfit assembly
- enough depth for comparison

---

## 22. Recommendation engine requirements

## Inputs
- explicit user answers
- intent text
- situation tags
- body-type concern
- budget
- mood/style preference
- avoidances
- stored feedback history
- normalized product features
- review summaries

## Outputs
- 3 recommended outfits
- per-slot alternative options
- explanation text
- risk/warning text
- comparison-ready metadata

## Engine behavior rules
1. Hard constraints first
   - budget
   - avoidances
   - stock
   - required situation fit

2. Suitability scoring second
   - style alignment
   - fit/body-type alignment
   - review quality
   - return/shipping practicality

3. Diversity balancing third
   - do not output 3 near-identical outfits
   - ensure meaningful variation

4. Explainability generation always
   - do not return recommendation without reason

5. Confidence disclosure always
   - if data quality is low, say so

---

## 23. Trust UX requirements

## Mandatory trust UI elements
- “what we considered”
- “what we excluded”
- “why this works for you”
- “review evidence”
- “fit/size caution”
- “shipping/return note”
- “confidence level”
- “data freshness / sync time” where useful

## Generation progress UI
During recommendation creation, show progress-like messages such as:
- analyzing your situation
- reading fit reviews
- comparing return conditions
- checking budget match
- building 3 outfit options

## Limitation copy examples
- exact fit may vary by body shape and brand pattern
- seller photos may differ from real color tone
- return fee may change on seller page
- body-type-specific review data may be limited for this item

---

## 24. Screen-by-screen MVP requirements

## 24.1 Landing / first entry
Purpose:
- frame the product as decision support
- immediately prompt situation-based entry

Must show:
- concise value proposition
- situation entry point
- optional “start with a quick interview”

Primary prompt:
- “어떤 상황의 옷을 찾고 있나요?”

## 24.2 Quick interview
Must collect:
- situation
- budget
- mood
- fit preference
- body-type concern
- color preference or avoidances

Must be:
- short
- selectable
- low-friction
- skippable only where safe

## 24.3 Recommendation loading state
Must show:
- explicit progress-like status
- considered conditions summary
- excluded constraints summary if relevant

## 24.4 Recommendation results
Must show:
- 3 outfits
- outfit rationale
- slot items
- alternatives
- total price estimate
- review summary
- fit warnings
- save/feedback CTA
- compare CTA
- purchase CTA

## 24.5 Comparison screen
Must show:
- outfit or item comparison table
- fit/material/price/shipping/return/review differences
- best-for labels

## 24.6 Purchase prep view
Must show:
- selected item links
- recommended size/variant guidance if possible
- final cautions
- purchase link-out

## 24.7 Feedback capture
Must allow:
- like
- dislike
- too expensive
- too basic
- too flashy
- too slim
- not my taste
- show more like this

---

## 25. Feedback memory requirements

Feedback is not cosmetic. It is future recommendation fuel.

## Minimum feedback types
- liked
- disliked
- too expensive
- too flashy
- too basic
- too slim
- not flattering
- color mismatch
- similar to what I want

## Memory goals
- improve style alignment
- improve fit alignment
- reduce repeated misses
- build personal taste graph over time

## Long-term value
Taste memory is a compounding product asset.
Without memory, recommendations risk staying generic.

---

## 26. Metrics

## Primary MVP metrics
1. recommendation satisfaction
2. purchase link click-through rate
3. 7-day revisit rate

## Secondary metrics
- onboarding completion rate
- recommendation result reach rate
- compare usage rate
- save rate
- feedback submission rate
- outfit click rate
- item click rate
- time-to-decision
- “understands my taste” survey score

## Interpretation
If recommendation satisfaction and purchase link-out are weak, the product thesis is not working even if engagement exists.

---

## 27. Roadmap

## Phase 1: MVP
- quick interview
- 3 outfit recommendations
- explanation
- review summary
- comparison
- purchase link-out
- feedback

## Phase 2: stronger personalization
- purchase history awareness
- saved preferences
- stronger body-type reasoning
- repeated situation memory
- better similarity retrieval

## Phase 3: agentic support expansion
- price drop alert
- restock alert
- substitute recommendation
- reorder / exchange guidance (not autonomous execution yet)

## Phase 4: higher-order experience
- wardrobe-aware recommendation
- duplicate avoidance
- season capsule suggestions
- more canvas-like / page-less exploration
- stronger brand expression

---

## 28. Strategic constraints

## Hard constraints
- Korean market first
- web app first
- semi-closed catalog first
- narrow target first
- explanation-first
- no autonomous checkout
- no open-web aggregation at MVP
- no feature explosion

## Soft constraints
- brand can become warmer later
- more expressive browsing UX can come later
- page-less or richer editorial experience is later-stage, not MVP

---

## 29. Non-goals

Do not optimize for:
- massive SKU breadth
- social virality first
- fashion inspiration browsing first
- entertainment feed retention
- agentic checkout theater
- virtual fitting as centerpiece
- all fashion segments simultaneously
- luxury branding over utility
- “AI looks cool” demos without measurable user trust

---

## 30. Competitive framing

## Amazon Rufus
Strong in platform catalog + automation.
Weak for Korean-specific fashion nuance and multi-brand Korean context.

## Perplexity Comet
Strong in open-web delegation.
Weak for fashion-specific normalized data quality and platform risk.

## Pinterest / visual inspiration platforms
Strong in taste discovery.
Weak in decision completion.

## Wardrobe-first apps
Strong for using what users already own.
Weak in fast purchase decision completion.

## Brand-owned stylists
Strong inside one brand.
Weak for multi-brand comparison.

### Our lane
**Multi-brand, Korean-context, fit-aware, explanation-rich, decision-completion fashion engine.**

---

## 31. Open questions (keep explicit)

These are unresolved and should remain visible, not silently assumed.

1. Exact first-brand catalog set
2. Seller integration model
3. Data ingestion mechanism
4. Review structuring pipeline
5. How much free text vs pickers in onboarding
6. Body-type taxonomy standardization
7. Size recommendation confidence methodology
8. How to define “confidence score” responsibly
9. Purchase-link attribution / commission model
10. Whether to include favorites/account from day 1
11. Whether guest mode should be allowed at MVP
12. Whether men/women should launch together or one first
13. How many categories are truly needed in first catalog
14. What minimum review volume is needed for reliable summary

---

## 32. Engineering / Codex implementation notes

This section is intentionally practical for code generation and product scaffolding.

## 32.1 Priority implementation order
1. data model / schema
2. seed catalog ingestion
3. onboarding flow
4. recommendation logic scaffold
5. explanation + trust UI
6. comparison module
7. feedback persistence
8. click-out flow
9. metrics instrumentation
10. refinement

## 32.2 Architecture preference
Favor a modular system with clear boundaries:
- `catalog`
- `reviews`
- `user_profile`
- `recommendation_engine`
- `explanations`
- `comparison`
- `feedback_memory`
- `analytics`
- `ui`

## 32.3 Recommendation logic guideline
Start rule-based / heuristic-assisted if needed.
Do not block MVP waiting for perfect ML.

The MVP can be valid if:
- constraint filtering is strong
- outfit assembly is good
- explanations are reliable
- data normalization is solid
- trust UX is clear

## 32.4 Default implementation behavior
If data is missing:
- degrade gracefully
- disclose uncertainty
- never hallucinate precise fit confidence

## 32.5 Content style guideline
UI copy should be:
- clear
- grounded
- low-hype
- practically helpful
- not overly anthropomorphic
- not falsely authoritative

---

## 33. Current confirmed brand decisions from this conversation

These were confirmed in the conversation after the source texts and should be treated as current brand-direction inputs unless changed later.

## App name
**픽핏**

## Suggested sub-copy
**내 상황에 맞는 코디를 고르는 가장 빠른 방법**

## Brand tone
- smart
- fast
- precise
- clean
- fashion-aware
- not overly cute
- not overly luxury-editorial
- not cold-fintech-like

## Final visual style direction
**Urban Smart Fashion Utility**
- minimal
- structured
- fast
- trustworthy
- fashion-tech hybrid

## Confirmed color system
### Main colors
- Brand Blue: `#6574FF`
- CTA Blue: `#4D5EFF`
- Accent Lime: `#E4FF5D`

### Neutrals
- Ink: `#12141A`
- Text Secondary: `#5F6675`
- Border: `#D9DCE6`
- Background: `#F7F8FC`

### Usage guidance
- Brand Blue: logo, app icon, brand graphics, large highlights
- CTA Blue: primary buttons, active tabs, selected states, progress
- Accent Lime: badges, recommendation highlights, micro accents, status accents
- Ink: titles, numbers, core info
- Text Secondary: body text, descriptions, secondary labels
- Border: dividers, input borders, separators
- Background: default app background

### Ratio guidance
- background : main : sub ≈ 6 : 3 : 1
- keep lime usage low; it is an accent, not a dominant surface color

## Typography
- Pretendard Variable
- headline tracking may go slightly tighter
- body copy should remain readable and not overly condensed

## Logo direction
Current chosen direction in conversation:
- `ㅍㅍ`-based logo exploration
- selected direction leaned toward the more minimal `ㅍㅍ` structure
- use this only as branding input, not as a hard-coded product requirement

---

## 34. Final product statement for all future work

When in doubt, return to this statement:

**픽핏은 한국형 상황·체형·예산 기반 패션 결정 에이전트 웹앱이다. 사용자가 옷을 오래 구경하게 만드는 것이 목적이 아니라, 몇 가지 질문만으로 상황과 취향을 이해하고 구조화된 상품·리뷰 데이터를 바탕으로 완성 코디와 추천 이유를 제시해 빠르고 신뢰감 있게 구매 결정을 끝내게 만드는 것이 목적이다. MVP는 반폐쇄형 카탈로그, 설명 가능한 추천, 비교 기능, 리뷰 요약, 핏/사이즈 리스크 경고, 구매 링크 이동, 피드백 축적에 집중한다.**

---

## 35. Final anti-drift checklist

Before adding any feature, ask:

1. Does this reduce decision time?
2. Does this increase trust?
3. Does this depend on structured data we actually have?
4. Does this fit the narrow MVP?
5. Does this help outfit recommendation rather than distract from it?
6. Does this strengthen our moat?
7. Would this still make sense if we are a web app with a semi-closed catalog?
8. Is this a real user need, or just “AI feature temptation”?

If the answer is mostly no, do not build it.

---