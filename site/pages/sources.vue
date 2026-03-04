<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-3">Data Sources &amp; Methodology</h1>
    <p class="text-primary-500 mb-6">All data used on this site is drawn from public, authoritative sources. Below is a full accounting of every dataset, indicator, and how the data is processed.</p>

    <div class="flex flex-wrap gap-2 mb-10">
      <a href="#methodology" class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors">
        Jump to Methodology
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
      </a>
    </div>

    <div class="space-y-10">

      <!-- Economic & Demographic -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">Economic &amp; Demographic</h2>
        </div>

        <div class="space-y-4 text-sm text-primary-600">
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">World Bank Open Data</h3>
            <p class="mb-2">Primary source for country-level economic and demographic indicators, accessed via the <a href="https://data.worldbank.org/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">World Bank API</a>.</p>
            <div class="bg-primary-50 rounded-xl p-4">
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-left text-primary-400 uppercase tracking-wider">
                    <th class="pb-2 font-medium">Indicator</th>
                    <th class="pb-2 font-medium">Code</th>
                  </tr>
                </thead>
                <tbody class="text-primary-600">
                  <tr><td class="py-1">GDP (nominal, current USD)</td><td class="py-1 font-mono text-primary-400">NY.GDP.MKTP.CD</td></tr>
                  <tr><td class="py-1">GDP per capita (current USD)</td><td class="py-1 font-mono text-primary-400">NY.GDP.PCAP.CD</td></tr>
                  <tr><td class="py-1">Population</td><td class="py-1 font-mono text-primary-400">SP.POP.TOTL</td></tr>
                  <tr><td class="py-1">CO2 emissions (Mt)</td><td class="py-1 font-mono text-primary-400">EN.GHG.CO2.MT.CE.AR5</td></tr>
                  <tr><td class="py-1">Life expectancy at birth</td><td class="py-1 font-mono text-primary-400">SP.DYN.LE00.IN</td></tr>
                  <tr><td class="py-1">Military expenditure (current USD)</td><td class="py-1 font-mono text-primary-400">MS.MIL.XPND.CD</td></tr>
                  <tr><td class="py-1">Military expenditure (% of GDP)</td><td class="py-1 font-mono text-primary-400">MS.MIL.XPND.GD.ZS</td></tr>
                  <tr><td class="py-1">Armed forces (% of labor force)</td><td class="py-1 font-mono text-primary-400">MS.MIL.XPND.ZS</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 class="font-semibold text-primary-800 mb-1">REST Countries</h3>
            <p>Country metadata (capital, region, subregion, area) from <a href="https://restcountries.com/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">REST Countries API</a>.</p>
          </div>

          <div>
            <h3 class="font-semibold text-primary-800 mb-1">UNDP Human Development Index</h3>
            <p>HDI values from the <a href="https://hdr.undp.org/data-center/human-development-index" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">UNDP Human Development Report 2023-24</a>, covering 200+ countries.</p>
          </div>
        </div>
      </section>

      <!-- UN General Assembly -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">UN General Assembly Voting</h2>
        </div>

        <div class="space-y-4 text-sm text-primary-600">
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Voting Records</h3>
            <p>Complete General Assembly voting data from the <a href="https://digitallibrary.un.org/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">United Nations Digital Library</a>, covering 5,694 resolutions across 202 countries.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Resolution Themes</h3>
            <p>Resolutions are classified into thematic categories (Nuclear &amp; Disarmament, Palestine &amp; Middle East, Human Rights, etc.) using UN subject headings and document metadata.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Voting Alignment</h3>
            <p>Pairwise agreement scores between countries are computed from GA voting patterns over the last 10 sessions.</p>
          </div>
        </div>
      </section>

      <!-- UN Security Council -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">UN Security Council</h2>
        </div>

        <div class="space-y-4 text-sm text-primary-600">
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Membership History</h3>
            <p>Permanent and non-permanent member terms since 1946 from the <a href="https://www.un.org/securitycouncil/content/members" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">UN Security Council</a>.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Vetoes</h3>
            <p>All vetoes cast by P5 members since 1946 from the <a href="https://www.un.org/depts/dhl/resguide/scact_veto_table_en.htm" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">Dag Hammarskj&ouml;ld Library</a>.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Resolution Votes</h3>
            <p>Curated set of notable Security Council resolutions with individual member votes from the <a href="https://www.un.org/securitycouncil/content/resolutions-0" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">UN Security Council</a>.</p>
          </div>
        </div>
      </section>

      <!-- Treaties -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">International Treaties</h2>
        </div>

        <div class="text-sm text-primary-600">
          <p class="mb-3">Party, signatory, and withdrawal status from the <a href="https://treaties.un.org/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">United Nations Treaty Collection</a> for 12 major international treaties:</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-primary-500">
            <span>ICC Rome Statute</span>
            <span>NPT (Non-Proliferation)</span>
            <span>Paris Agreement</span>
            <span>UNCLOS (Law of the Sea)</span>
            <span>CTBT (Test Ban)</span>
            <span>Cluster Munitions Convention</span>
            <span>Arms Trade Treaty</span>
            <span>Ottawa Treaty (Mine Ban)</span>
            <span>Convention against Torture</span>
            <span>Convention on Rights of the Child</span>
            <span>Refugee Convention</span>
            <span>TPNW (Nuclear Prohibition)</span>
          </div>
        </div>
      </section>

      <!-- Sanctions -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">Sanctions</h2>
        </div>

        <div class="text-sm text-primary-600">
          <p>14 active UN sanctions regimes with measures (arms embargo, travel ban, asset freeze) and target countries, from the <a href="https://www.un.org/securitycouncil/sanctions/information" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">UN Security Council Sanctions Committees</a>.</p>
        </div>
      </section>

      <!-- Diplomatic Recognition -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">Diplomatic Recognition</h2>
        </div>

        <div class="text-sm text-primary-600">
          <p class="mb-2">Recognition stances compiled from official government statements, UN records, and diplomatic sources for 4 disputed/contested entities:</p>
          <div class="flex flex-wrap gap-2">
            <span class="text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-100">Kosovo</span>
            <span class="text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-100">Palestine</span>
            <span class="text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-100">Taiwan</span>
            <span class="text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-100">Western Sahara (SADR)</span>
          </div>
        </div>
      </section>

      <!-- Military & Defense -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">Military &amp; Defense</h2>
        </div>

        <div class="space-y-4 text-sm text-primary-600">
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Military Expenditure</h3>
            <p><a href="https://www.sipri.org/databases/milex" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">SIPRI Military Expenditure Database</a> via <a href="https://data.worldbank.org/indicator/MS.MIL.XPND.CD" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">World Bank</a> &mdash; spending in current USD, as % of GDP, and armed forces as % of labor force.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Military Capabilities</h3>
            <p><a href="https://www.globalfirepower.com/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">Global Firepower 2025</a> &mdash; power index rankings, personnel strength, aircraft, armor, naval assets, and defense budgets for 145 countries.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Conflict Events</h3>
            <p><a href="https://acleddata.com/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">ACLED (Armed Conflict Location &amp; Event Data)</a> &mdash; aggregated conflict event counts and fatalities by type (battles, explosions, violence against civilians, protests, riots) for 2023&ndash;2025.</p>
          </div>
        </div>
      </section>

      <!-- GDELT Events & Tone -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">GDELT Events &amp; Media Tone</h2>
        </div>

        <div class="space-y-4 text-sm text-primary-600">
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">GDELT Event Database</h3>
            <p>The <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">GDELT Project</a> monitors news media worldwide and codes events using the <a href="http://data.gdeltproject.org/documentation/CAMEO.Manual.1.1b3.pdf" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">CAMEO coding system</a> (Conflict and Mediation Event Observations). Events are classified into 20 root codes ranging from cooperative (codes 01-10: statements, appeals, cooperation, aid) to conflictual (codes 11-20: disapproval, threats, coercion, assault).</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">GDELT DOC API</h3>
            <p>Media tone data is sourced from the <a href="https://blog.gdeltproject.org/gdelt-doc-2-0-api-discovering-the-patterns-of-our-global-world/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">GDELT DOC 2.0 API</a>, which provides timeline-based aggregate sentiment analysis from global news coverage over the past 12 months.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Goldstein Scale</h3>
            <p>Each CAMEO event type has an associated Goldstein Scale score ranging from -10 (most conflictual) to +10 (most cooperative). Average Goldstein scores per country reflect the overall cooperative vs. conflictual balance of events involving that country.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Data Period &amp; Processing</h3>
            <p>Event data is sourced from GDELT v1 daily export CSVs. Each daily file is stream-parsed to extract actor country codes, event types, Goldstein scores, and tone values. Per-country and per-bilateral-pair aggregates are computed for event counts, cooperative/conflictual breakdowns, and average tone.</p>
          </div>
        </div>
      </section>

      <!-- UN General Debate Speeches -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">UN General Debate Speeches</h2>
        </div>

        <div class="space-y-4 text-sm text-primary-600">
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">GA High-Level General Debate</h3>
            <p>Full-text speeches from the <a href="https://gadebate.un.org/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">UN General Assembly General Debate</a> (High-Level Week), covering sessions 75&ndash;79 (2020&ndash;2024). PDF statements are downloaded and converted to text using pdf-parse.</p>
          </div>
          <div>
            <h3 class="font-semibold text-primary-800 mb-1">Keyword Extraction</h3>
            <p>Keywords are extracted from each speech using frequency analysis of unigrams and bigrams, with common English stopwords and UN procedural language filtered out. The top 15 keywords per speech surface the most prominent topics discussed by each country's delegation.</p>
          </div>
        </div>
      </section>

      <!-- Country Groups -->
      <section class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-5">
          <span class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">Country Group Definitions</h2>
        </div>

        <div class="text-sm text-primary-600">
          <p class="mb-3">{{ groupCount }} group definitions from the open-source <strong>worldcountrygroups</strong> package, drawn from official organization sources, UN, and World Bank classifications.</p>
          <div class="flex flex-wrap gap-3">
            <a href="https://pypi.org/project/worldcountrygroups/" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-xs font-medium text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors">
              PyPI
            </a>
            <a href="https://github.com/tomasgonz/worldcountrygroups" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </section>

      <!-- Methodology -->
      <section id="methodology" class="bg-white rounded-2xl border-2 border-primary-200 p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6">
          <span class="w-8 h-8 rounded-lg bg-primary-900 flex items-center justify-center text-white">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
          </span>
          <h2 class="font-serif text-xl font-bold text-primary-900">Methodology</h2>
        </div>

        <p class="text-sm text-primary-600 mb-8">This section documents how raw data is collected, processed, aggregated, and presented throughout the site.</p>

        <div class="space-y-8">

          <!-- Data Collection & Freshness -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Data Collection &amp; Freshness</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Country-level indicators are fetched from the <strong>World Bank API</strong> for the date range <strong>2018&ndash;2024</strong>. For each indicator and each country, only the <strong>most recent year with available data</strong> is retained. This means different countries may report data from different years depending on their reporting cadence to the World Bank.</p>
              <p>World Bank data is fetched in batches of 30 countries per API call. If a batch fails (e.g., due to an unrecognized code), each country in that batch is retried individually to maximise coverage.</p>
              <p><strong>HDI</strong> values are bundled from the UNDP Human Development Report 2023&ndash;24 (reference year 2022) and updated when a new report is published.</p>
              <p>Geographic metadata (capital, region, subregion, area) comes from the REST Countries API. Country names are sourced from REST Countries when available, with a fallback to the World Country Groups registry.</p>
              <p>All data writes use an <strong>atomic write</strong> pattern (write to a temporary file, then rename) to prevent partial or corrupted data from being served.</p>
            </div>
          </div>

          <!-- Group Aggregation -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Group-Level Aggregation</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>When statistics are displayed for a country group (e.g., G7, NATO), values are computed as the <strong>sum</strong> of all member countries that have data for that indicator. This applies to GDP, population, CO2 emissions, military expenditure, military personnel, equipment counts, and defense budgets.</p>
              <p>Each group stat displays a <strong>coverage figure</strong> (e.g., &ldquo;28 of 30 countries&rdquo;) so users can assess completeness. Countries with missing data for a given indicator are excluded from the sum rather than treated as zero.</p>
              <p>Per-capita and percentage indicators (GDP per capita, military % of GDP, HDI) are <strong>not summed</strong> across groups. They are shown only at the individual country level.</p>
            </div>
          </div>

          <!-- Country Rankings -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Country Rankings within Groups</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>On each country page, the rankings table shows how that country compares within each of its groups. For each metric (GDP, population, CO2), the table shows the country's <strong>absolute value</strong>, its <strong>rank</strong> within the group (1 = highest), and its <strong>percentage share</strong> of the group total.</p>
            </div>
          </div>

          <!-- Voting Alignment -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">UN Voting Alignment Scores</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Pairwise alignment scores measure how similarly two countries vote in the UN General Assembly. The calculation works as follows:</p>
              <ol class="list-decimal list-inside space-y-1 ml-2">
                <li>Only votes from the <strong>last 10 GA sessions</strong> are considered.</li>
                <li>For each resolution, the vote of Country A is compared to the vote of Country B. Possible votes are <strong>Yes (Y)</strong>, <strong>No (N)</strong>, and <strong>Abstain (A)</strong>.</li>
                <li><strong>Non-voting / absent (X)</strong> records are excluded from the comparison entirely &mdash; they are neither agreements nor disagreements.</li>
                <li>An <strong>exact match</strong> (Y-Y, N-N, or A-A) counts as agreement. Any mismatch (Y-N, Y-A, N-A) counts as disagreement.</li>
                <li>The alignment score is: <code class="bg-primary-100 px-1.5 py-0.5 rounded text-xs">agreement_count / total_compared_votes</code>, producing a value between 0 and 1.</li>
                <li>A minimum of <strong>10 commonly voted resolutions</strong> is required for a pair to be included. This filters out countries with insufficient overlap.</li>
              </ol>
              <p>The &ldquo;Most Aligned&rdquo; and &ldquo;Least Aligned&rdquo; lists show the top 15 countries by this score.</p>
            </div>
          </div>

          <!-- Group Voting Cohesion -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Group Voting Cohesion</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>When viewing a group's voting record, cohesion is calculated per resolution. For each resolution, the <strong>majority vote</strong> among group members is determined, and cohesion equals the fraction of the group that voted with the majority. For example, if 10 members vote Yes and 4 vote No, cohesion for that resolution is 10/14 = 71.4%.</p>
            </div>
          </div>

          <!-- Theme Classification -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Resolution Theme Classification</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Each UN General Assembly resolution is classified into thematic categories using <strong>keyword pattern matching</strong> against the resolution title and UN subject headings. The classification rules:</p>
              <ul class="list-disc list-inside space-y-1 ml-2">
                <li>Each resolution is assigned a <strong>maximum of 2 themes</strong>.</li>
                <li>Themes are checked in a fixed priority order (Nuclear &amp; Disarmament first, Budget &amp; Administration last).</li>
                <li>A special &ldquo;Country-Specific Situations&rdquo; theme is applied only when the title matches patterns like &ldquo;situation in [country]&rdquo; or &ldquo;question of [territory]&rdquo; and fewer than 2 themes have already been assigned.</li>
                <li>Resolutions that match no pattern are classified as &ldquo;Other&rdquo;.</li>
              </ul>
              <p>The 16 thematic categories are:</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-primary-500 mt-2">
                <span>Nuclear &amp; Disarmament</span>
                <span>Palestine &amp; Middle East</span>
                <span>Human Rights</span>
                <span>Colonialism &amp; Self-Determination</span>
                <span>Economic Development</span>
                <span>LDCs, LLDCs &amp; SIDS</span>
                <span>Environment &amp; Sustainability</span>
                <span>Refugees &amp; Migration</span>
                <span>Apartheid &amp; South Africa</span>
                <span>Peacekeeping &amp; Security</span>
                <span>International Law</span>
                <span>Outer Space</span>
                <span>Health &amp; Social</span>
                <span>Information &amp; Cyber</span>
                <span>Budget &amp; Administration</span>
                <span>Country-Specific Situations</span>
              </div>
            </div>
          </div>

          <!-- Military Capabilities -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Military Capabilities &amp; Defense Spending</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Military data comes from two independent sources with different scope:</p>
              <ul class="list-disc list-inside space-y-1 ml-2">
                <li><strong>SIPRI / World Bank</strong> (160 countries): Official government-reported military expenditure in current USD, as a percentage of GDP, and armed forces as a share of the total labor force. This data follows the same most-recent-year selection as other World Bank indicators.</li>
                <li><strong>Global Firepower 2025</strong> (145 countries): A composite military power index plus detailed hardware and personnel inventories (active/reserve personnel, aircraft, tanks, naval vessels, defense budgets).</li>
              </ul>
              <p>At the group level, all military metrics are <strong>summed</strong> across members. The &ldquo;Top Members by Power Index&rdquo; list ranks members by the Global Firepower composite score (lower score = stronger military).</p>
              <p>Note that the SIPRI defense budget and Global Firepower defense budget may differ for the same country, as they use different estimation methodologies and reference years.</p>
            </div>
          </div>

          <!-- Conflict Events -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Conflict Events &amp; Intensity</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Conflict data from <strong>ACLED</strong> covers the period <strong>2023&ndash;2025</strong>. Events are pre-aggregated by country and broken down by type:</p>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-primary-500 ml-2 my-2">
                <span>Battles</span>
                <span>Explosions &amp; Remote Violence</span>
                <span>Violence Against Civilians</span>
                <span>Protests</span>
                <span>Riots</span>
                <span>Strategic Developments</span>
              </div>
              <p>Each country is assigned a <strong>conflict intensity</strong> level (high, medium, low, or none) based on total event counts and fatality figures. This classification is pre-computed in the source data rather than calculated dynamically.</p>
              <p>At the group level, events and fatalities are summed, and the &ldquo;Members with Active Conflict&rdquo; list ranks affected members by total fatalities (descending).</p>
              <p>Year-over-year trend charts on country pages show the fatality trajectory across the covered period, with bar heights proportional to the year with the highest fatality count.</p>
            </div>
          </div>

          <!-- GDELT Events & Tone -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">GDELT Events &amp; Media Tone</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>GDELT data is processed in two phases:</p>
              <ol class="list-decimal list-inside space-y-1 ml-2">
                <li><strong>Event data</strong>: Daily GDELT v1 export CSVs are stream-parsed. Each event record provides actor country codes (CAMEO format), event root codes, Goldstein Scale scores, mention counts, and average tone. Events are classified as cooperative (CAMEO codes 01-10), conflictual (11-20), or neutral.</li>
                <li><strong>Media tone</strong>: For the top countries by event volume, the GDELT DOC API provides 12-month timeline tone data, which captures aggregate media sentiment weighted by article volume.</li>
              </ol>
              <p><strong>Cooperation ratio</strong> is computed as <code class="bg-primary-100 px-1.5 py-0.5 rounded text-xs">cooperative_events / (cooperative_events + conflictual_events)</code>. Neutral events are excluded from this ratio. A ratio above 0.5 indicates more cooperative than conflictual events.</p>
              <p>Bilateral relationship data pairs countries by co-occurrence in GDELT events and computes per-pair cooperation ratios and tone averages. Only the top 10 partners by event volume are retained per country.</p>
              <p>At the group level, tone is weighted by article volume, and cooperation ratio is computed from aggregate cooperative and conflictual event counts. Intra-group pairs show bilateral relationships where both actors are group members.</p>
            </div>
          </div>

          <!-- UN General Debate Speeches -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">UN General Debate Speeches</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Speech PDFs are downloaded from <strong>gadebate.un.org</strong> for each country and session. Text is extracted using <code class="bg-primary-100 px-1.5 py-0.5 rounded text-xs">pdf-parse</code> (based on Mozilla PDF.js). PDFs that yield fewer than 100 characters of text (likely scanned images) are skipped.</p>
              <p><strong>Keyword extraction</strong> uses frequency-based analysis:</p>
              <ol class="list-decimal list-inside space-y-1 ml-2">
                <li>Text is lowercased and split into words (minimum 4 characters).</li>
                <li>Common English stopwords and UN procedural language (~200 terms) are removed.</li>
                <li>Unigram and bigram frequencies are counted. Bigrams appearing 3+ times are included.</li>
                <li>The top 15 terms by frequency are retained as keywords.</li>
              </ol>
              <p>Country-to-URL mapping uses a slug-based lookup built from the country registry, with fallback to parsing the ISO2 code from the PDF URL embedded in each country's page HTML.</p>
            </div>
          </div>

          <!-- Diplomatic Recognition -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Diplomatic Recognition</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Recognition data tracks 4 disputed or contested entities: Kosovo, Palestine, Taiwan, and Western Sahara (SADR). For each entity, the dataset records:</p>
              <ul class="list-disc list-inside space-y-1 ml-2">
                <li>The <strong>list of recognizing countries</strong> (by ISO3 code)</li>
                <li>Countries that have <strong>withdrawn recognition</strong></li>
                <li>The entity's <strong>UN membership status</strong> (member, observer-state, non-member)</li>
                <li>The date independence was declared</li>
              </ul>
              <p>A country's stance toward each entity is determined by its presence in the recognizer or withdrawal lists. Countries not in either list are classified as &ldquo;Does Not Recognize.&rdquo;</p>
            </div>
          </div>

          <!-- Sanctions -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Sanctions Regimes</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Sanctions data covers <strong>14 active UN Security Council sanctions regimes</strong>. Each regime record includes the establishing UNSC resolution, the date it was established, the types of measures imposed (arms embargo, travel ban, asset freeze, etc.), and the targeted countries.</p>
              <p>A country is shown as &ldquo;under sanctions&rdquo; if it appears in the target list of one or more regimes. The measures displayed are specific to that regime, not aggregated across regimes.</p>
            </div>
          </div>

          <!-- Treaties -->
          <div>
            <h3 class="font-semibold text-primary-900 mb-2">Treaty Ratification</h3>
            <div class="text-sm text-primary-600 space-y-2">
              <p>Treaty status is tracked for 12 major international treaties from the UN Treaty Collection. Each country's relationship to a treaty falls into one of four categories:</p>
              <ul class="list-disc list-inside space-y-1 ml-2">
                <li><strong>Party</strong> &mdash; has ratified or acceded to the treaty</li>
                <li><strong>Signatory Only</strong> &mdash; has signed but not ratified</li>
                <li><strong>Withdrawn</strong> &mdash; was a party but has since withdrawn</li>
                <li><strong>Not Party</strong> &mdash; has neither signed nor ratified</li>
              </ul>
            </div>
          </div>

          <!-- Limitations -->
          <div class="bg-amber-50 rounded-xl border border-amber-200 p-5">
            <h3 class="font-semibold text-amber-900 mb-2">Limitations &amp; Caveats</h3>
            <div class="text-sm text-amber-800 space-y-2">
              <ul class="list-disc list-inside space-y-1.5">
                <li><strong>Data lag:</strong> World Bank indicators can lag 1&ndash;2 years behind the current date. The &ldquo;most recent year&rdquo; shown may differ across countries and across indicators.</li>
                <li><strong>Coverage gaps:</strong> Not all countries report all indicators. Small states, territories, and countries in conflict often have incomplete data. Coverage percentages are shown where applicable.</li>
                <li><strong>Theme classification:</strong> Resolution themes are assigned by keyword matching, not by expert review. Some resolutions may be misclassified or assigned to overly broad categories.</li>
                <li><strong>Alignment scores:</strong> Voting alignment measures co-voting behaviour, not diplomatic alignment. Two countries may vote similarly for different reasons, or diverge on votes while being close allies.</li>
                <li><strong>Conflict intensity:</strong> ACLED intensity levels are pre-computed aggregates. They do not capture the full context of each conflict (duration, scale of displacement, strategic significance).</li>
                <li><strong>Military data discrepancies:</strong> SIPRI and Global Firepower use different methodologies. Defense budgets may differ between sources for the same country and year.</li>
                <li><strong>Recognition data:</strong> Diplomatic recognition is fluid. States may have ambiguous or evolving positions that are not fully captured by a binary recognizes/does-not-recognize classification.</li>
                <li><strong>GDELT data:</strong> GDELT captures media-reported events, not all real-world events. Countries with more English-language media coverage are overrepresented. Tone scores reflect media framing, not objective reality. The cooperation ratio is a rough proxy and should not be interpreted as a measure of actual diplomatic relationships.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Last Updated -->
      <div v-if="meta?.updated_at" class="bg-primary-50 rounded-2xl border border-primary-100 p-6 sm:p-8">
        <h2 class="font-serif text-lg font-bold text-primary-900 mb-3">Last Updated</h2>
        <p class="text-sm text-primary-600 mb-3">
          Data last refreshed: <strong>{{ formatDate(meta.updated_at) }}</strong>
        </p>
        <div v-if="meta.sources" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div v-for="(ts, source) in meta.sources" :key="source" class="text-xs">
            <div class="text-primary-400 uppercase tracking-wider mb-0.5">{{ source }}</div>
            <div class="text-primary-600 font-medium">{{ ts ? formatDate(ts) : 'N/A' }}</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Data Sources — World Country Groups' })

const { groups } = useGroups()
const groupCount = computed(() => groups.value?.length ?? 47)

const { data: meta } = useFetch('/api/meta')

function formatDate(iso: string): string {
  if (!iso) return 'N/A'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
</script>
