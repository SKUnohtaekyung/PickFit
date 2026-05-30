# PickFit Fashion-Expert Normalization Spec

> Knowledge base injected into the catalog fill pipeline (`crawler/musinsa-normalize.js`).
> Turns a Musinsa product (descriptive Korean name + best-effort crawled detail
> page) into the structured comparison fields. Honest by design: crawled facts
> win; name inference is a labelled lower-confidence fallback; genuinely unknown
> stays `unknown`/`null` (UI shows "정보 부족"). Never fabricate material % or
> review text.

## Signal priority
1. **Crawled detail page** (`musinsa-detail.jsonl`): real material composition
   (`Cotton 55%, Polyester 40%`), `시즌 YYYY SS/FW`, category path. → confidence 0.8.
2. **Product name + batch JSONL** (always present): fit/season/color cues in the
   Korean name; `reviewScore`/`reviewCount` for ratings. → confidence 0.5.

## Concept maps
- **Fit (fitType)** — name cues: 오버/오버핏/오버사이즈/세미오버→`oversized`, 와이드→`wide`,
  슬림/스키니→`slim`, 릴렉스/릴랙스→`relaxed`, 스트레이트→`straight`,
  레귤러/스탠다드/베이직→`regular`. Else slot default (top/outer→regular,
  bottom→straight, shoes→`unknown`).
- **Material (materialMain)** — parse `<EN|KO> NN%` from crawl; map EN→KO
  (Cotton→면, Polyester→폴리, Linen→린넨, Wool→울, Nylon→나일론, Spandex→스판,
  Rayon→레이온, Acrylic→아크릴, Leather→가죽, Modal→모달, Tencel→텐셀…); keep top 2 by %.
  No crawl → infer dominant fibre from name (린넨/니트/데님/스웨트/면/가죽…).
- **Season (seasonality[])** — `시즌 …SS`→[spring,summer], `…FW`→[fall,winter];
  else by fabric/sleeve: 반팔·민소매·린넨·에어·메쉬·시어서커→summer; 기모·니트·코트·패딩·
  울·플리스·무스탕→winter; default basics→[spring,fall].
- **Color (colorFamily)** — Korean color word in name → 블랙/화이트/네이비/그레이/베이지/
  브라운/카키/블루/그린/레드/핑크/아이보리/데님블루…
- **Thickness/Opacity/Stretch** — from fabric: spandex→stretch high; 니트→medium;
  else low. 기모·패딩·코트·울·니트→heavy; 린넨·에어·메쉬·반팔→light; else medium.
  린넨·시어·메쉬→opacity semi; else opaque.
- **Style tags** — 트랙·조거·스웨트·후드·데님→[street,casual]; 셔츠·블레이저·슬랙스→
  [classic,clean]; 니트·가디건→[minimal,soft]; 티셔츠·반팔→[casual]; else by slot.
- **Occasion tags** — 셔츠·블레이저·슬랙스·면바지→[office,interview,date];
  트레이닝·조거·스웨트·후드·반팔티→[daily,casual]; 니트·가디건→[daily,date,office];
  코트·패딩→[daily,office]; else [daily,casual].
- **Fit risk** — oversized/wide→중간(품·어깨 넓음); slim→중간(타이트); regular/
  straight→낮음; unknown→정보부족. (Crawled review fit feedback wins if present.)
- **Rating** — `reviewScore` (0–100) ÷ 20 = 5-point scale; `reviewCount` from JSONL.
  `reviewCount=0` → no review row (UI shows 정보 부족).
