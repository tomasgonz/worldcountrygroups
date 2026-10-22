<template>
  <div class="space-y-6">
    <VizTip />

    <div v-if="pending && !d" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 text-sm text-primary-500">Loading the Secretary-General race…</div>
    <div v-else-if="!d" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 text-sm text-primary-500">
      Secretary-General selection data is not available yet.
    </div>

    <template v-else>
      <!-- ================= HERO ================= -->
      <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="text-[11px] uppercase tracking-wider text-accent-600 font-semibold mb-1">United Nations · selection {{ termYear }}</div>
        <h2 class="font-serif text-2xl sm:text-3xl font-bold text-primary-900 leading-tight">Who will be the next Secretary-General?</h2>
        <p class="mt-1 text-sm text-primary-600">{{ d._meta.status_line }}</p>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div class="rounded-xl bg-primary-50 px-3 py-2.5">
            <div class="text-[11px] uppercase tracking-wider text-primary-400">Official candidates</div>
            <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ active.length }}</div>
            <div class="text-[11px] text-primary-500">{{ women }} women · {{ withdrawn.length }} withdrawn</div>
          </div>
          <div class="rounded-xl bg-primary-50 px-3 py-2.5">
            <div class="text-[11px] uppercase tracking-wider text-primary-400">Straw polls</div>
            <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ polls.length }}</div>
            <div class="text-[11px] text-primary-500">
              <template v-if="latestPoll">latest {{ fmtDate(latestPoll.date) }}</template>
              <template v-else>none held yet</template>
            </div>
          </div>
          <div class="rounded-xl bg-primary-50 px-3 py-2.5">
            <div class="text-[11px] uppercase tracking-wider text-primary-400">Most "encourage"</div>
            <div class="font-serif text-lg font-bold text-primary-900 leading-tight truncate">{{ leader ? leader.candidate : '–' }}</div>
            <div class="text-[11px] text-primary-500">
              <template v-if="leader">{{ leader.encourage }} encourage · {{ leader.discourage }} discourage</template>
            </div>
          </div>
          <div class="rounded-xl bg-primary-50 px-3 py-2.5">
            <div class="text-[11px] uppercase tracking-wider text-primary-400">P5 ballots</div>
            <div class="font-serif text-lg font-bold leading-tight" :class="anyColour ? 'text-accent-700' : 'text-primary-900'">
              {{ anyColour ? 'Colour-coded' : 'Not yet colour-coded' }}
            </div>
            <div class="text-[11px] text-primary-500">{{ anyColour ? 'possible vetoes visible' : 'vetoes cannot be identified' }}</div>
          </div>
        </div>

        <p v-if="d.process.expected_appointment.outlook" class="mt-4 text-sm text-primary-700 border-l-2 border-accent-400 pl-3">
          {{ d.process.expected_appointment.outlook.text }}
          <a :href="d.process.expected_appointment.outlook.url" target="_blank" rel="noopener" class="text-primary-500 underline decoration-dotted whitespace-nowrap">{{ d.process.expected_appointment.outlook.source }}, {{ fmtDate(d.process.expected_appointment.outlook.date) }}</a>
        </p>
        <p class="mt-3 text-xs text-primary-400">
          Guterres's term ends {{ fmtDate(d.process.expected_appointment.term_ends) }}; the next Secretary-General takes office {{ fmtDate(d.process.expected_appointment.takes_office) }}.
          Updated {{ fmtDateTime(d._meta.updated_at) }} ·
          <a :href="OFFICIAL" target="_blank" rel="noopener" class="underline decoration-dotted">official UN page</a>
        </p>
      </section>

      <!-- ================= CANDIDATES ================= -->
      <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h3 class="font-serif text-xl font-bold text-primary-900">Official candidates</h3>
          <span class="text-xs text-primary-400">Nominated by Member States, per the UN</span>
        </div>
        <p class="text-sm text-primary-500 mb-4">Ordered by "encourage" votes in the latest straw poll.</p>

        <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <article v-for="c in active" :key="c.id" class="rounded-2xl ring-1 ring-primary-200/70 p-4 flex flex-col">
            <CandHead :c="c" />
            <p v-if="c.current_role" class="mt-3 text-sm text-primary-700">{{ c.current_role }}</p>
            <details v-if="c.previous_roles.length" class="mt-1 text-xs text-primary-500">
              <summary class="cursor-pointer select-none hover:text-primary-700">Career ({{ c.previous_roles.length }})</summary>
              <ul class="mt-1 space-y-0.5 list-disc pl-4">
                <li v-for="(r, i) in c.previous_roles" :key="i">{{ r }}</li>
              </ul>
            </details>
            <div v-if="c.latest_poll" class="mt-3">
              <div class="text-[11px] text-primary-400 mb-1">Straw poll {{ c.latest_poll.n }} ({{ fmtDate(c.latest_poll.date) }})</div>
              <MiniBallot :e="c.latest_poll.encourage" :dd="c.latest_poll.discourage" :n="c.latest_poll.no_opinion" />
            </div>
            <button v-if="mFor(c.id)" type="button" class="mt-2 text-left text-[11px] text-primary-500 hover:text-accent-700" @click="scrollToMarket()">
              Betting market <span class="font-semibold text-primary-800 tabular-nums">{{ fmtPct(mFor(c.id)!.price) }}</span>
              <template v-if="mFor(c.id)!.thin && mFor(c.id)!.bid != null && mFor(c.id)!.ask != null"> · thin, bids {{ fmtPct(mFor(c.id)!.bid!) }} to asks {{ fmtPct(mFor(c.id)!.ask!) }}</template>
            </button>
            <div class="mt-auto pt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <a v-if="c.vision_statement_url" :href="c.vision_statement_url" target="_blank" rel="noopener" class="text-primary-700 underline decoration-dotted hover:text-accent-700">Vision statement</a>
              <a v-if="c.cv_url" :href="c.cv_url" target="_blank" rel="noopener" class="text-primary-700 underline decoration-dotted hover:text-accent-700">CV</a>
              <a v-if="c.letter_url" :href="c.letter_url" target="_blank" rel="noopener" class="text-primary-700 underline decoration-dotted hover:text-accent-700">Nomination letter</a>
              <a v-if="c.webcast_url" :href="c.webcast_url" target="_blank" rel="noopener" class="text-primary-700 underline decoration-dotted hover:text-accent-700">
                Dialogue webcast<template v-if="c.dialogue_date"> ({{ fmtDate(c.dialogue_date, true) }})</template>
              </a>
              <NuxtLink v-if="c.slug" :to="`/people/${c.slug}`" class="text-primary-700 underline decoration-dotted hover:text-accent-700">Profile</NuxtLink>
              <button type="button" class="text-primary-500 hover:text-accent-700" @click="newsFilter = c.id; scrollToNews()">News ({{ c.news_count_60d }})</button>
            </div>
          </article>
        </div>

        <div v-if="withdrawn.length" class="mt-6">
          <h4 class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-2">Withdrawn</h4>
          <div class="grid sm:grid-cols-2 gap-3">
            <div v-for="c in withdrawn" :key="c.id" class="rounded-xl bg-primary-50 p-3 opacity-90">
              <CandHead :c="c" small />
              <p class="mt-2 text-xs text-primary-600">
                Withdrawn {{ fmtDate(c.withdrawal_date) }}<template v-if="c.withdrawal_announced && c.withdrawal_announced !== c.withdrawal_date"> (announced {{ fmtDate(c.withdrawal_announced) }})</template>.
                <template v-for="(w, i) in c.withdrawals" :key="i">
                  <a v-if="w.url" :href="w.url" target="_blank" rel="noopener" class="underline decoration-dotted ml-1">Letter{{ w.symbol ? ` ${w.symbol}` : '' }}</a>
                </template>
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- ================= STRAW POLLS ================= -->
      <section v-if="polls.length" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h3 class="font-serif text-xl font-bold text-primary-900">Security Council straw polls</h3>
          <button type="button" class="text-xs text-primary-500 underline decoration-dotted" @click="showTable = !showTable">{{ showTable ? 'Show chart' : 'Show as table' }}</button>
        </div>
        <p class="text-sm text-primary-500 mb-4">
          Each of the 15 Council members marks every candidate "encourage", "discourage" or "no opinion". Results are not published; these are leaked tallies reported by the press.
          A formal recommendation needs 9 votes and no veto from a permanent member.
        </p>

        <!-- poll selector -->
        <div class="flex flex-wrap gap-1.5 mb-4" role="tablist" aria-label="Straw poll">
          <button
            v-for="p in polls" :key="p.n" type="button" role="tab" :aria-selected="p.n === selN"
            class="px-2.5 py-1 rounded-full text-xs ring-1 transition"
            :class="p.n === selN ? 'bg-primary-900 text-white ring-primary-900' : 'bg-white text-primary-700 ring-primary-200 hover:ring-primary-400'"
            @click="selN = p.n"
          >
            Poll {{ p.n }} · {{ fmtDate(p.date, true) }}<span v-if="p.colour_coded" class="ml-1 px-1 rounded bg-amber-100 text-amber-800">P5 colour-coded</span>
          </button>
        </div>

        <template v-if="sel">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-primary-600 mb-3">
            <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" :style="{ background: RED }" />Discourage</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" :style="{ background: AQUA }" />Encourage</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" :style="{ background: GREY }" />No opinion</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-px h-3 border-l-2 border-dashed border-primary-500" />9 votes</span>
            <span v-if="p5Col" class="inline-flex items-center gap-1"><span class="font-bold text-emerald-700">✓</span><span class="font-bold text-red-700">✕</span> P5: permanent members among them</span>
          </div>

          <div v-if="!sel.results.length" class="text-sm text-primary-500">Results for this poll have not been reported in a form we can read yet.</div>

          <div v-else-if="!showTable" class="space-y-1.5">
            <div v-for="r in sel.results" :key="r.candidate_id"
              class="grid items-center gap-2" :style="{ gridTemplateColumns: pollCols }">
              <span class="text-[13px] text-primary-800 truncate" :title="r.candidate">{{ r.candidate }}</span>
              <div class="relative h-7 rounded-md hover:bg-primary-50 cursor-default" tabindex="0"
                :aria-label="`${r.candidate}: ${r.encourage} encourage, ${r.discourage} discourage, ${r.no_opinion} no opinion`"
                @mousemove="tipPoll(r, $event)" @mouseleave="hide" @focus="tipPoll(r, $event)" @blur="hide">
                <!-- centre line and 9-vote threshold -->
                <div class="absolute top-0 bottom-0 left-1/2 w-px bg-primary-300" />
                <div class="absolute top-0 bottom-0 border-l-2 border-dashed border-primary-400/70" :style="{ left: `calc(50% + ${pct(9)})` }" />
                <!-- discourage (left) -->
                <div class="absolute top-1/2 -translate-y-1/2 h-4 rounded-l-[4px] flex items-center justify-start pl-1"
                  :style="{ right: 'calc(50% + 1px)', width: pct(r.discourage), background: RED }">
                  <span v-if="r.discourage >= 2" class="text-[10px] font-semibold text-white tabular-nums">{{ r.discourage }}</span>
                </div>
                <!-- encourage (right) -->
                <div class="absolute top-1/2 -translate-y-1/2 h-4 rounded-r-[4px] flex items-center justify-end pr-1"
                  :style="{ left: 'calc(50% + 1px)', width: pct(r.encourage), background: AQUA }">
                  <span v-if="r.encourage >= 2" class="text-[10px] font-semibold text-white tabular-nums">{{ r.encourage }}</span>
                </div>
              </div>
              <span class="text-[11px] tabular-nums text-primary-500 text-right" :title="`${r.no_opinion} no opinion`">
                <span class="inline-block w-2 h-2 rounded-sm align-middle mr-0.5" :style="{ background: GREY }" />{{ r.no_opinion }}
              </span>
              <span v-if="p5Col" class="text-[11px] font-bold tabular-nums whitespace-nowrap text-right">
                <span v-if="r.p5_encourage" class="text-emerald-700"
                  :title="r.p5_encourage_n != null ? `${r.p5_encourage_n} of the 5 permanent members encouraged` : 'At least one permanent member encouraged'">✓{{ r.p5_encourage_n ?? '' }}</span>
                <span v-if="r.p5_discourage" class="text-red-700 ml-1"
                  :title="r.p5_discourage_n != null ? `${r.p5_discourage_n} of the 5 permanent members discouraged` : 'At least one permanent member discouraged'">✕{{ r.p5_discourage_n ?? '' }}</span>
              </span>
            </div>
            <div class="grid gap-2 text-[10px] text-primary-400 tabular-nums" :style="{ gridTemplateColumns: pollCols }">
              <span />
              <div class="flex justify-between"><span>15<span class="hidden sm:inline"> ← discourage</span></span><span>0</span><span><span class="hidden sm:inline">encourage → </span>15</span></div>
              <span />
              <span v-if="p5Col" class="text-right">P5</span>
            </div>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-primary-400">
                  <th class="py-1 pr-3 font-medium">Candidate</th>
                  <th v-for="p in polls" :key="p.n" class="py-1 px-2 font-medium text-center whitespace-nowrap">Poll {{ p.n }}<br><span class="normal-case tracking-normal">{{ fmtDate(p.date, true) }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in tableRows" :key="c.id" class="border-t border-primary-100">
                  <td class="py-1.5 pr-3 text-primary-800 whitespace-nowrap">{{ c.name }}</td>
                  <td v-for="p in polls" :key="p.n" class="py-1.5 px-2 text-center tabular-nums whitespace-nowrap text-primary-700">
                    <template v-if="cell(p, c.id)">
                      {{ cell(p, c.id)!.encourage }}–{{ cell(p, c.id)!.discourage }}–{{ cell(p, c.id)!.no_opinion }}
                      <div v-if="hasP5n(cell(p, c.id)!)" class="text-[10px] text-primary-400">P5 {{ cell(p, c.id)!.p5_encourage_n }}–{{ cell(p, c.id)!.p5_discourage_n }}–{{ cell(p, c.id)!.p5_no_opinion_n }}</div>
                    </template>
                    <span v-else class="text-primary-300">–</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="text-[11px] text-primary-400 mt-1">Encourage–discourage–no opinion.<template v-if="anyColour"> P5: the permanent members' votes among them (colour-coded polls).</template></p>
          </div>

          <p class="mt-3 text-[11px] text-primary-400">
            {{ sel.ballot_note }}.
            Sources:
            <template v-for="(s, i) in sel.sources" :key="s.url + i">
              <a :href="s.url" target="_blank" rel="noopener" class="underline decoration-dotted">{{ shortSource(s) }}</a><span v-if="i < sel.sources.length - 1">, </span>
            </template>
          </p>
        </template>

        <!-- trend across polls: small multiples -->
        <div v-if="pollsWithResults.length > 1" class="mt-6">
          <h4 class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-1">Trend across polls</h4>
          <p class="text-[11px] text-primary-400 mb-3">Votes out of 15. <span :style="{ color: AQUA_TEXT }">●</span> encourage (solid) · <span :style="{ color: RED }">●</span> discourage (dashed).</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div v-for="c in trendCands" :key="c.id" class="rounded-xl bg-primary-50/60 p-2.5">
              <div class="text-[12px] font-medium text-primary-800 truncate" :title="c.name">{{ c.name }}</div>
              <svg :viewBox="`0 0 ${TW} ${TH}`" class="w-full h-16 mt-1 overflow-visible" role="img" :aria-label="`${c.name}: encourage ${c.poll_history.map(h => h.encourage).join(', ')}; discourage ${c.poll_history.map(h => h.discourage).join(', ')}`">
                <line :x1="0" :x2="TW" :y1="ty(9)" :y2="ty(9)" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 3" />
                <polyline :points="line(c, 'discourage')" fill="none" :stroke="RED" stroke-width="2" stroke-dasharray="4 3" stroke-linejoin="round" />
                <polyline :points="line(c, 'encourage')" fill="none" :stroke="AQUA" stroke-width="2" stroke-linejoin="round" />
                <g v-for="h in c.poll_history" :key="h.n">
                  <circle :cx="tx(h.n)" :cy="ty(h.discourage)" r="3" :fill="RED" stroke="#fff" stroke-width="1.5" />
                  <circle :cx="tx(h.n)" :cy="ty(h.encourage)" r="3.5" :fill="AQUA" stroke="#fff" stroke-width="1.5" />
                  <rect :x="tx(h.n) - 8" y="0" width="16" :height="TH" fill="transparent" class="cursor-default"
                    @mousemove="tipTrend(c.name, h, $event)" @mouseleave="hide" />
                </g>
              </svg>
              <div class="flex justify-between text-[10px] text-primary-400 tabular-nums">
                <span>P{{ pollsWithResults[0].n }}</span><span>P{{ pollsWithResults[pollsWithResults.length - 1].n }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ================= PREDICTION MARKET ================= -->
      <section v-if="market" ref="marketEl" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h3 class="font-serif text-xl font-bold text-primary-900">What the betting market expects</h3>
          <button v-if="mSeries.length" type="button" class="text-xs text-primary-500 underline decoration-dotted" @click="showMTable = !showMTable">{{ showMTable ? 'Show chart' : 'Show as table' }}</button>
        </div>
        <p class="text-sm text-primary-500 mb-4">
          Prices on <a :href="market.url" target="_blank" rel="noopener" class="underline decoration-dotted">Polymarket</a>, a real-money prediction market, read as the chance traders put on each person becoming Secretary-General.
          They are bets, not votes. Each price is the midpoint between the best offer to buy and the best offer to sell; where those are more than 10 points apart the price is thin and the gap is drawn as a band.
        </p>

        <div class="grid gap-2 text-[10px] uppercase tracking-wider text-primary-400 mb-1" :style="{ gridTemplateColumns: M_COLS }">
          <span /><span /><span class="text-right">Chance</span><span class="text-right">7 days</span>
        </div>
        <div class="space-y-1.5">
          <div v-for="o in market.outcomes" :key="o.market_name" class="grid items-center gap-2" :style="{ gridTemplateColumns: M_COLS }">
            <span class="text-[13px] text-primary-800 flex items-center gap-1.5 min-w-0" :title="o.name">
              <span class="w-3 h-0.5 rounded-full shrink-0" :style="{ background: mColour.get(o.market_name) || 'transparent' }" />
              <span class="min-w-0 flex flex-wrap items-center gap-x-1.5">
                <span class="truncate max-w-full">{{ o.name }}</span>
                <span v-if="o.race_status && o.race_status !== 'candidate'" class="text-[10px] uppercase tracking-wider px-1 rounded bg-primary-50 text-primary-500">{{ o.race_status === 'mentioned' ? 'not nominated' : o.race_status }}</span>
              </span>
            </span>
            <div class="relative h-6 rounded-md hover:bg-primary-50 cursor-default" tabindex="0" :aria-label="mAria(o)"
              @mousemove="tipMarket(o, $event)" @mouseleave="hide" @focus="tipMarket(o, $event)" @blur="hide">
              <div v-if="o.thin && o.bid != null && o.ask != null" class="absolute top-1/2 -translate-y-1/2 h-4 rounded-[4px]"
                :style="{ left: mPct(o.bid), width: mPct(o.ask - o.bid), background: GREY, opacity: 0.55 }" />
              <div class="absolute top-1/2 -translate-y-1/2 left-0 h-2.5 rounded-r-[4px]" :style="{ width: mPct(o.price), background: SLATE }" />
            </div>
            <span class="text-sm font-semibold tabular-nums text-right text-primary-900 leading-tight">
              {{ fmtPct(o.price) }}<span v-if="o.thin" class="block text-[10px] font-normal text-primary-400">thin</span>
            </span>
            <span class="text-[11px] tabular-nums text-right text-primary-500">{{ fmtPts(o.change_1w) }}</span>
          </div>
          <div class="grid gap-2 text-[10px] text-primary-400 tabular-nums" :style="{ gridTemplateColumns: M_COLS }">
            <span /><div class="flex justify-between"><span>0</span><span>{{ Math.round(mMax * 100) }}%</span></div><span /><span class="text-right">pts</span>
          </div>
        </div>
        <p class="mt-2 text-[11px] text-primary-500">{{ sumNote }}</p>

        <!-- price history -->
        <div v-if="mSeries.length" class="mt-6">
          <h4 class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-2">{{ showMTable ? 'Price at the end of each straw-poll day (UTC)' : 'Over time' }}</h4>
          <div v-show="!showMTable" ref="mWrap">
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary-600 mb-2">
              <span v-for="s in mSeries" :key="s.key" class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 rounded-full" :style="{ background: s.colour }" />{{ s.name }}</span>
              <span class="inline-flex items-center gap-1.5"><span class="h-3 border-l border-dashed border-primary-400" />Straw poll</span>
            </div>
            <svg :width="MW" :height="MH" class="block max-w-full select-none touch-pan-y" role="img" :aria-label="mChartAria"
              @pointermove="mMove" @pointerleave="mLeave">
              <g v-for="t in mYTicks" :key="t">
                <line :x1="ML" :x2="MW - MR" :y1="my(t)" :y2="my(t)" stroke="#e2e8f0" stroke-width="1" />
                <text :x="ML - 6" :y="my(t) + 3.5" text-anchor="end" fill="#94a3b8" font-size="10">{{ Math.round(t * 100) }}%</text>
              </g>
              <text v-for="m in mMonths" :key="m.t" :x="mx(m.t)" :y="MH - 6" text-anchor="middle" fill="#94a3b8" font-size="10">{{ m.label }}</text>
              <g v-for="p in mPolls" :key="p.n">
                <line :x1="mx(p.t)" :x2="mx(p.t)" :y1="MT" :y2="MH - MB" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 3" />
                <text v-if="mPollLabelled.has(p.n)" :x="mx(p.t)" :y="MT - 3" text-anchor="middle" fill="#94a3b8" font-size="9">P{{ p.n }}</text>
              </g>
              <polyline v-for="s in mSeries" :key="s.key" :points="s.points" fill="none" :stroke="s.colour" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
              <g v-for="l in mEndLabels" :key="l.key">
                <circle :cx="l.x" :cy="l.cy" r="3.5" :fill="l.colour" stroke="#fff" stroke-width="2" />
                <text :x="l.x + 8" :y="l.y + 3.5" font-size="11" fill="#334155">{{ l.label }}</text>
              </g>
              <g v-if="mHover">
                <line :x1="mHover.x" :x2="mHover.x" :y1="MT" :y2="MH - MB" stroke="#475569" stroke-width="1" />
                <circle v-for="pt in mHover.pts" :key="pt.key" :cx="mHover.x" :cy="pt.y" r="4" :fill="pt.colour" stroke="#fff" stroke-width="2" />
              </g>
            </svg>
            <p class="text-[11px] text-primary-400 mt-1">Every 12 hours since the market opened{{ market.opened ? ` (${fmtDate(market.opened)})` : '' }}, up to the price shown above; the {{ mSeries.length }} highest-priced names.</p>
          </div>
          <div v-if="showMTable" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-primary-400">
                  <th class="py-1 pr-3 font-medium">Name</th>
                  <th v-for="p in mPolls" :key="p.n" class="py-1 px-2 font-medium text-center whitespace-nowrap">Poll {{ p.n }}<br><span class="normal-case tracking-normal">{{ fmtDate(p.date, true) }}</span></th>
                  <th class="py-1 px-2 font-medium text-center">Now</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="o in market.outcomes" :key="o.market_name" class="border-t border-primary-100">
                  <td class="py-1.5 pr-3 text-primary-800 whitespace-nowrap">{{ o.name }}</td>
                  <td v-for="p in mPolls" :key="p.n" class="py-1.5 px-2 text-center tabular-nums text-primary-700">
                    <template v-if="priceAt(o, p.end) != null">{{ fmtPct(priceAt(o, p.end)!) }}</template><span v-else class="text-primary-300">–</span>
                  </td>
                  <td class="py-1.5 px-2 text-center tabular-nums font-semibold text-primary-900">{{ fmtPct(o.price) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p class="mt-4 text-[11px] text-primary-400">
          ${{ fmtMoney(market.volume) }} traded, ${{ fmtMoney(market.volume_24h) }} in the last 24 hours · updated {{ fmtDateTime(markets!._meta.updated_at) }} ·
          <a :href="market.url" target="_blank" rel="noopener" class="underline decoration-dotted">{{ market.title }}</a>
          <template v-for="s in markets!._meta.skipped" :key="s.url">
            · Not shown: <a :href="s.url" target="_blank" rel="noopener" class="underline decoration-dotted">{{ s.title }}</a> ({{ s.reason }})
          </template>
        </p>
      </section>

      <!-- ================= FORECASTS: market, model, your own call ================= -->
      <ElectionsSgForecast v-if="d.forecast" :sg="d" />

      <!-- ================= TIMELINE ================= -->
      <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h3 class="font-serif text-xl font-bold text-primary-900">Process timeline</h3>
          <div class="flex flex-wrap gap-1">
            <button v-for="k in KINDS" :key="k.key" type="button"
              class="px-2 py-0.5 rounded-full text-[11px] ring-1"
              :class="kindOn[k.key] ? 'bg-primary-100 text-primary-800 ring-primary-300' : 'bg-white text-primary-400 ring-primary-200 line-through'"
              @click="kindOn[k.key] = !kindOn[k.key]">{{ k.label }}</button>
          </div>
        </div>
        <p class="text-sm text-primary-500 mb-4">
          {{ d.process.nomination_window.note }}
        </p>
        <ol class="relative border-l-2 border-primary-100 ml-2 space-y-3">
          <li v-for="(e, i) in timeline" :key="i" class="pl-4 relative">
            <span class="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ring-2 ring-white" :class="e.upcoming ? 'bg-white border-2 border-primary-300' : ''" :style="e.upcoming ? {} : { background: kindColour(e.kind) }" />
            <div class="text-[11px] tabular-nums text-primary-400">
              {{ fmtDate(e.date) }}<span v-if="e.upcoming" class="ml-1 text-accent-600">upcoming</span>
              <span class="ml-1 uppercase tracking-wider">· {{ kindLabel(e.kind) }}</span>
            </div>
            <div class="text-sm text-primary-800">
              <a v-if="e.url" :href="e.url" target="_blank" rel="noopener" class="hover:underline">{{ e.title }}</a>
              <template v-else>{{ e.title }}</template>
            </div>
            <div v-if="e.detail" class="text-xs text-primary-500">{{ e.detail }}</div>
          </li>
        </ol>
        <div v-if="d.process.gender_and_region_notes.length" class="mt-5 grid sm:grid-cols-2 gap-2">
          <p v-for="(n, i) in d.process.gender_and_region_notes" :key="i" class="text-xs text-primary-600 rounded-lg bg-primary-50 px-3 py-2">
            {{ n.text }} <a :href="n.url" target="_blank" rel="noopener" class="text-primary-400 underline decoration-dotted">source</a>
          </p>
        </div>
      </section>

      <!-- ================= ALSO MENTIONED ================= -->
      <section v-if="d.also_mentioned.length" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <h3 class="font-serif text-xl font-bold text-primary-900">Also mentioned in coverage</h3>
        <div class="mt-2 mb-4 rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-sm text-amber-900">
          <strong>Not candidates.</strong> These people have been discussed in the press or by trackers as possible contenders, or have said they are interested,
          but no Member State has nominated them. Article counts are race stories from the last {{ d._meta.window_days }} days that mention the name, often in passing (for example as an endorser).
        </div>
        <ul class="divide-y divide-primary-100">
          <li v-for="m in d.also_mentioned" :key="m.id" class="py-2.5 flex gap-3 items-start">
            <span class="text-lg leading-none mt-0.5 w-6 shrink-0 text-center" aria-hidden="true">{{ m.iso2 ? isoToFlag(m.iso2) : '·' }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2">
                <NuxtLink v-if="m.slug" :to="`/people/${m.slug}`" class="font-medium text-primary-900 hover:underline">{{ m.name }}</NuxtLink>
                <a v-else-if="m.wikipedia_url" :href="m.wikipedia_url" target="_blank" rel="noopener" class="font-medium text-primary-900 hover:underline">{{ m.name }}</a>
                <span v-else class="font-medium text-primary-900">{{ m.name }}</span>
                <span class="text-[10px] uppercase tracking-wider px-1.5 py-px rounded" :class="statusCls(m.status)">{{ statusLabel(m.status) }}</span>
                <span v-if="m.role" class="text-xs text-primary-500">{{ m.role }}</span>
              </div>
              <p v-if="m.why" class="text-xs text-primary-600 mt-0.5">{{ m.why }}</p>
              <div class="text-[11px] text-primary-400 mt-0.5 flex flex-wrap gap-x-2">
                <span>{{ m.mention_count_60d }} race article{{ m.mention_count_60d === 1 ? '' : 's' }} ({{ d._meta.window_days }} days)</span>
                <span v-if="m.first_mentioned">earliest dated evidence {{ fmtDate(m.first_mentioned) }}</span>
                <template v-for="(e, i) in m.evidence.slice(0, 3)" :key="e.url">
                  <a :href="e.url" target="_blank" rel="noopener" class="underline decoration-dotted truncate max-w-[14rem]" :title="e.title">source {{ i + 1 }}</a>
                </template>
                <button v-if="m.mention_count_60d" type="button" class="hover:text-accent-700" @click="newsFilter = 'm:' + m.id; scrollToNews()">articles</button>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- ================= NEWS ================= -->
      <section ref="newsEl" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 class="font-serif text-xl font-bold text-primary-900">News</h3>
          <label class="text-xs text-primary-500 flex items-center gap-2">
            <span>Filter</span>
            <select v-model="newsFilter" class="text-sm rounded-lg border-primary-200 py-1 pl-2 pr-7 max-w-[14rem]">
              <option value="">All coverage ({{ d.news.length }})</option>
              <optgroup label="Candidates">
                <option v-for="c in d.candidates" :key="c.id" :value="c.id">{{ c.name }}{{ c.status === 'withdrawn' ? ' (withdrawn)' : '' }} ({{ countFor(c.id) }})</option>
              </optgroup>
              <optgroup label="Also mentioned (not candidates)">
                <option v-for="m in d.also_mentioned.filter(x => x.mention_count_60d)" :key="m.id" :value="'m:' + m.id">{{ m.name }} ({{ m.mention_count_60d }})</option>
              </optgroup>
            </select>
          </label>
        </div>
        <ul class="divide-y divide-primary-100">
          <li v-for="n in newsShown" :key="n.url" class="py-2">
            <a :href="n.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:underline">{{ n.title }}</a>
            <div class="text-[11px] text-primary-400 mt-0.5 flex flex-wrap gap-x-2">
              <span>{{ n.outlet || 'News' }}</span>
              <span class="tabular-nums">{{ fmtDate(n.date) }}</span>
              <span v-for="id in n.candidates_mentioned.slice(0, 4)" :key="id" class="px-1 rounded bg-primary-50 text-primary-600">{{ candName(id) }}</span>
            </div>
          </li>
        </ul>
        <p v-if="!newsShown.length" class="text-sm text-primary-500">No articles in the last {{ d._meta.window_days }} days.</p>
        <button v-if="newsFiltered.length > newsLimit" type="button" class="mt-3 text-sm text-primary-600 underline decoration-dotted" @click="newsLimit += 25">
          Show more ({{ newsFiltered.length - newsLimit }} left)
        </button>
      </section>

      <!-- ================= SOURCES ================= -->
      <details class="text-xs text-primary-500 px-1">
        <summary class="cursor-pointer select-none">About this data and sources</summary>
        <ul class="mt-2 list-disc pl-5 space-y-1">
          <li v-for="(n, i) in d._meta.notes" :key="i">{{ n }}</li>
          <li v-for="(x, i) in d._meta.discrepancies" :key="'d' + i">Source disagreement: {{ x }}</li>
        </ul>
        <ul class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <li v-for="s in d._meta.sources" :key="s.url"><a :href="s.url" target="_blank" rel="noopener" class="underline decoration-dotted">{{ s.name }}</a></li>
        </ul>
      </details>
    </template>
  </div>
</template>

<script setup lang="ts">
import { h, defineComponent, type PropType } from 'vue'
import { isoToFlag, useCountries } from '~/composables/useGroups'

// ---- types (mirror server/utils/sg-selection.ts) ----
interface PollPoint { n: number; date: string; encourage: number; discourage: number; no_opinion: number }
interface Cand {
  id: string; name: string; official_name: string; slug: string | null
  nationality: string | null; nationality_iso2: string | null; nationality_name: string | null
  nominated_by: string[]; nominated_by_names: string[]; nominated_by_iso2?: (string | null)[]
  nomination_date: string | null; status: 'nominated' | 'withdrawn' | 'selected'
  withdrawal_date: string | null; withdrawal_announced: string | null
  withdrawals: { date: string | null; by: string[]; url: string | null; symbol: string | null }[]
  gender: 'female' | 'male' | null; region_group: string | null; region_group_code: string | null
  current_role: string | null; previous_roles: string[]
  vision_statement_url: string | null; cv_url: string | null; letter_url: string | null
  dialogue_date: string | null; webcast_url: string | null
  photo: string | null; photo_official: string | null
  news_count_60d: number; poll_history: PollPoint[]; latest_poll: PollPoint | null
}
interface PollResult {
  candidate: string; candidate_id: string; encourage: number; discourage: number; no_opinion: number; p5_encourage: boolean | null; p5_discourage: boolean | null
  p5_encourage_n?: number | null; p5_discourage_n?: number | null; p5_no_opinion_n?: number | null
}
interface Poll { n: number; date: string; colour_coded: boolean; ballot_note: string | null; results: PollResult[]; source_url: string; sources: { name: string; url: string }[] }
interface Ev { date: string; kind: string; title: string; url: string | null; detail: string | null; upcoming: boolean }
interface Mentioned { id: string; name: string; slug: string | null; role: string | null; iso2: string | null; status: string | null; why: string | null; evidence: { title: string; url: string; date: string | null }[]; mention_count_60d: number; first_mentioned: string | null; wikipedia_url: string | null }
interface News { title: string; url: string; outlet: string | null; date: string; candidates_mentioned: string[]; also_mentioned: string[] }
interface MOutcome {
  name: string; market_name: string; person_id: string | null; race_status: string | null
  price: number; bid: number | null; ask: number | null; last: number | null; spread: number | null; thin: boolean
  change_1d: number | null; change_1w: number | null; volume: number; volume_24h: number; url: string; history: [number, number][]
}
interface Market { slug: string; title: string; url: string; opened: string | null; volume: number; volume_24h: number; liquidity: number; price_sum: number; outcomes: MOutcome[] }
interface Markets { _meta: { updated_at: string; skipped: { title: string; url: string; reason: string }[]; notes: string[] }; markets: Market[] }
interface SgData {
  _meta: { updated_at: string; status_line: string; notes: string[]; discrepancies: string[]; sources: { name: string; url: string }[]; window_days: number }
  process: {
    nomination_window: { note: string }
    straw_polls: Poll[]
    timeline: Ev[]
    gender_and_region_notes: { text: string; url: string }[]
    expected_appointment: { term_ends: string; takes_office: string; outlook: { text: string; url: string; date: string; source: string } | null }
  }
  candidates: Cand[]
  also_mentioned: Mentioned[]
  news: News[]
  markets: Markets | null
  forecast: unknown | null // rendered by SgForecast.vue
}

const OFFICIAL = 'https://www.un.org/en/sg-selection-and-appointment'
const AQUA = '#1baf7a'
const AQUA_TEXT = '#11815a'
const RED = '#e34948'
const GREY = '#cbd5e1'
const BLUE = '#2a78d6'
const ORANGE = '#eb6834'
const AMBER = '#eda100'
const SLATE = '#475569'
const SERIES = [BLUE, ORANGE, AQUA, AMBER] // categorical order, validated as a set

const { data, pending } = useFetch<SgData>('/api/un-elections/sg', { query: { news_limit: 400 }, server: false })
const d = computed(() => data.value || null)
const { countries: allCountries } = useCountries()
const iso2Of = computed(() => new Map<string, string>(((allCountries.value as any[]) || []).map((x: any) => [x.iso3, x.iso2])))

const { show, hide } = useVizTip()

const active = computed(() => (d.value?.candidates || []).filter(c => c.status !== 'withdrawn'))
const withdrawn = computed(() => (d.value?.candidates || []).filter(c => c.status === 'withdrawn'))
const women = computed(() => active.value.filter(c => c.gender === 'female').length)
const polls = computed(() => d.value?.process.straw_polls || [])
const pollsWithResults = computed(() => polls.value.filter(p => p.results.length))
const latestPoll = computed(() => pollsWithResults.value[pollsWithResults.value.length - 1] || polls.value[polls.value.length - 1] || null)
const leader = computed(() => latestPoll.value?.results[0] || null)
const anyColour = computed(() => polls.value.some(p => p.colour_coded))
const termYear = computed(() => (d.value?.process.expected_appointment.term_ends || '2026').slice(0, 4))

// ---- straw poll chart ----
const selN = ref<number>(0)
watchEffect(() => { if (!selN.value && latestPoll.value) selN.value = latestPoll.value.n })
const sel = computed(() => polls.value.find(p => p.n === selN.value) || null)
const showTable = ref(false)
const pct = (v: number) => `${(Math.min(v, 15) / 15) * 50}%`
const hasP5n = (r: PollResult) => r.p5_encourage_n != null && r.p5_discourage_n != null
const p5Col = computed(() => !!sel.value?.results.some(r => r.p5_encourage || r.p5_discourage))
const pollCols = computed(() => `minmax(6.5rem, 30%) 1fr 2.2rem${p5Col.value ? ' 2.8rem' : ''}`)
function tipPoll(r: PollResult, e: MouseEvent | FocusEvent) {
  const of = (k: number | null | undefined) => (hasP5n(r) ? ` (${k ?? 0} P5)` : '')
  const lines: { text: string; color?: string }[] = [
    { text: `${r.encourage} encourage${of(r.p5_encourage_n)}`, color: AQUA },
    { text: `${r.discourage} discourage${of(r.p5_discourage_n)}`, color: RED },
    { text: `${r.no_opinion} no opinion${of(r.p5_no_opinion_n)}`, color: GREY },
  ]
  if (r.p5_discourage) lines.push({ text: hasP5n(r) ? `${r.p5_discourage_n} P5 discourage (possible veto)` : 'At least one P5 discourage (possible veto)', color: RED })
  else if (hasP5n(r)) lines.push({ text: 'No P5 discourage', color: AQUA })
  if (r.p5_encourage && !hasP5n(r)) lines.push({ text: 'At least one P5 encourage', color: AQUA })
  lines.push({ text: r.encourage >= 9 ? 'Reaches the 9-vote threshold' : `${9 - r.encourage} short of 9 encourage` })
  show(e, `${r.candidate} · poll ${sel.value?.n}`, lines)
}
const tableRows = computed(() => (d.value?.candidates || []).filter(c => c.poll_history.length))
const cell = (p: Poll, id: string) => p.results.find(r => r.candidate_id === id) || null

// trend small multiples
const TW = 120
const TH = 56
const trendCands = computed(() => (d.value?.candidates || []).filter(c => c.poll_history.length > 0))
const pollNs = computed(() => pollsWithResults.value.map(p => p.n))
const tx = (n: number) => {
  const ns = pollNs.value
  if (ns.length < 2) return TW / 2
  return 6 + ((ns.indexOf(n)) / (ns.length - 1)) * (TW - 12)
}
const ty = (v: number) => 4 + (1 - v / 15) * (TH - 8)
const line = (c: Cand, k: 'encourage' | 'discourage') => c.poll_history.map(h => `${tx(h.n)},${ty(h[k])}`).join(' ')
function tipTrend(name: string, hh: PollPoint, e: MouseEvent) {
  show(e, `${name} · poll ${hh.n} (${fmtDate(hh.date, true)})`, [
    { text: `${hh.encourage} encourage`, color: AQUA },
    { text: `${hh.discourage} discourage`, color: RED },
    { text: `${hh.no_opinion} no opinion`, color: GREY },
  ])
}

// ---- prediction market ----
const markets = computed(() => d.value?.markets || null)
const market = computed(() => markets.value?.markets[0] || null)
const mByPerson = computed(() => new Map((market.value?.outcomes || []).filter(o => o.person_id).map(o => [o.person_id!, o])))
const mFor = (id: string) => mByPerson.value.get(id) || null
const M_COLS = 'minmax(6.5rem, 30%) 1fr 2.8rem 2.6rem'
const mMax = computed(() => {
  const top = Math.max(0.1, ...(market.value?.outcomes || []).map(o => Math.max(o.price, o.thin && o.ask != null ? o.ask : 0)))
  return Math.min(1, Math.ceil(top * 10) / 10)
})
const mPct = (v: number) => `${(Math.max(0, v) / mMax.value) * 100}%`
const fmtPct = (v: number) => (v < 0.001 ? '0%' : v < 0.1 ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`)
function fmtPts(c: number | null) {
  if (c == null) return '–'
  const p = Math.round(c * 100)
  return p > 0 ? `+${p}` : p < 0 ? `−${-p}` : '0'
}
const fmtMoney = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)))
const sumNote = computed(() => {
  const pct = Math.round((market.value?.price_sum ?? 0) * 100)
  if (pct >= 100) return `The prices add up to ${pct}%, more than 100%, because thin prices overlap.`
  return `The prices add up to ${pct}%. In a clean market they would make 100%; the other ${100 - pct} points are roughly the chance of someone not listed, blurred by thin prices.`
})
const mAria = (o: MOutcome) => `${o.name}: ${fmtPct(o.price)}${o.thin ? ', thin market' : ''}; ${fmtPts(o.change_1w)} points in a week`
function tipMarket(o: MOutcome, e: MouseEvent | FocusEvent) {
  const lines: { text: string; color?: string }[] = [
    { text: `${fmtPct(o.price)} midpoint of bid and ask${o.thin ? ' (thin: far apart)' : ''}`, color: SLATE },
  ]
  if (o.bid != null && o.ask != null) lines.push({ text: `Best bid ${fmtPct(o.bid)} · best ask ${fmtPct(o.ask)}`, color: GREY })
  if (o.last != null) lines.push({ text: `Last trade ${fmtPct(o.last)}` })
  if (o.change_1w != null) lines.push({ text: `${fmtPts(o.change_1d)} pts in a day · ${fmtPts(o.change_1w)} pts in a week` })
  lines.push({ text: `$${fmtMoney(o.volume)} traded on this name` })
  show(e, o.name, lines)
}
const marketEl = ref<HTMLElement | null>(null)
function scrollToMarket() { nextTick(() => marketEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }

// price history chart: sized to its container so text stays at its real size
const showMTable = ref(false)
const mWrap = ref<HTMLElement | null>(null)
const MW = ref(720)
const MH = 240
const ML = 36
const MR = computed(() => (MW.value < 500 ? 104 : 130))
const MT = 16
const MB = 22
let mRo: ResizeObserver | null = null
watch(mWrap, (el) => {
  mRo?.disconnect()
  if (!el || typeof ResizeObserver === 'undefined') return
  mRo = new ResizeObserver(([en]) => { if (en.contentRect.width) MW.value = Math.max(300, Math.round(en.contentRect.width)) })
  mRo.observe(el)
})
onBeforeUnmount(() => mRo?.disconnect())

const nowT = computed(() => Math.floor(new Date(markets.value?._meta.updated_at || Date.now()).getTime() / 1000))
const mRaw = computed(() => {
  const outs = (market.value?.outcomes || []).filter(o => o.history.length).slice(0, SERIES.length)
  const byName = [...outs].sort((a, b) => a.name.localeCompare(b.name)) // colour follows the person, not the rank
  return outs.map((o) => {
    const data = [...o.history]
    if (data[data.length - 1][0] >= nowT.value - 3600) data.pop()
    data.push([nowT.value, o.price])
    return { key: o.market_name, name: o.name, colour: SERIES[byName.indexOf(o)], data }
  })
})
const mColour = computed(() => new Map(mRaw.value.map(s => [s.key, s.colour])))
const mT0 = computed(() => Math.min(...mRaw.value.map(s => s.data[0][0])))
const mYMax = computed(() => Math.min(1, Math.ceil((Math.max(0.05, ...mRaw.value.flatMap(s => s.data.map(x => x[1]))) + 0.02) * 10) / 10))
const mx = (t: number) => ML + ((t - mT0.value) / Math.max(1, nowT.value - mT0.value)) * (MW.value - ML - MR.value)
const my = (p: number) => MT + (1 - p / mYMax.value) * (MH - MT - MB)
const mSeries = computed(() => mRaw.value.map(s => ({ ...s, points: s.data.map(([t, p]) => `${mx(t)},${my(p)}`).join(' ') })))
const mYTicks = computed(() => {
  const step = mYMax.value > 0.5 ? 0.2 : 0.1
  const out: number[] = []
  for (let v = 0; v <= mYMax.value + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
})
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const mMonths = computed(() => {
  const out: { t: number; label: string }[] = []
  const d0 = new Date(mT0.value * 1000)
  const every = MW.value < 520 ? 2 : 1
  for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1, i = 0; ; m++) {
    if (m > 11) { m = 0; y++ }
    const t = Date.UTC(y, m, 1) / 1000
    if (t > nowT.value) break
    if (i++ % every === 0) out.push({ t, label: MON[m] })
  }
  return out
})
// straw polls are held in New York in the afternoon: drawn at 20:00 UTC; the table reads the price at the day's end
const mPolls = computed(() => polls.value
  .map(p => ({ n: p.n, date: p.date, t: Date.parse(`${p.date}T20:00:00Z`) / 1000, end: Date.parse(`${p.date}T23:59:59Z`) / 1000 }))
  .filter(p => p.t >= mT0.value && p.t <= nowT.value))
const mPollLabelled = computed(() => {
  const keep = new Set<number>()
  let lastX = Infinity
  for (const p of [...mPolls.value].reverse()) if (lastX - mx(p.t) >= 18) { keep.add(p.n); lastX = mx(p.t) }
  return keep
})
function priceAt(o: MOutcome, t: number) {
  let best: number | null = null
  for (const [ts, p] of o.history) {
    if (ts > t) break
    best = ts >= t - 2 * 86400 ? p : null
  }
  return best
}
const shortName = (name: string) => { const w = name.split(' '); return w.length >= 4 ? w[2] : w.slice(1).join(' ') || name }
const mEndLabels = computed(() => {
  const ls = mRaw.value.map((s) => {
    const [t, p] = s.data[s.data.length - 1]
    return { key: s.key, colour: s.colour, x: mx(t), cy: my(p), y: my(p), label: `${shortName(s.name)} ${fmtPct(p)}` }
  }).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ls.length; i++) if (ls[i].y - ls[i - 1].y < 13) ls[i].y = ls[i - 1].y + 13
  const over = ls.length ? ls[ls.length - 1].y - (MH - MB) : 0
  if (over > 0) for (const l of ls) l.y -= over
  return ls
})
const mChartAria = computed(() => `Prediction-market price over time: ${mRaw.value.map(s => `${s.name} now ${fmtPct(s.data[s.data.length - 1][1])}`).join('; ')}`)
const mHover = ref<{ x: number; pts: { key: string; y: number; colour: string }[] } | null>(null)
function mMove(e: PointerEvent) {
  const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
  const x = (e.clientX - r.left) * (MW.value / r.width)
  if (x < ML || x > MW.value - MR.value + 4 || !mRaw.value.length) { mLeave(); return }
  const t = mT0.value + ((x - ML) / (MW.value - ML - MR.value)) * (nowT.value - mT0.value)
  // snap to the nearest point of the longest series, then read every series there
  const grid = mRaw.value.reduce((a, s) => (s.data.length > a.length ? s.data : a), [] as [number, number][])
  let snap = grid[0][0]
  for (const [ts] of grid) if (Math.abs(ts - t) < Math.abs(snap - t)) snap = ts
  const pts: { key: string; y: number; colour: string }[] = []
  const rows: { text: string; color: string; v: number }[] = []
  for (const s of mRaw.value) {
    let near: [number, number] | null = null
    for (const pt of s.data) if (!near || Math.abs(pt[0] - snap) < Math.abs(near[0] - snap)) near = pt
    if (!near || Math.abs(near[0] - snap) > 13 * 3600) continue
    pts.push({ key: s.key, y: my(near[1]), colour: s.colour })
    rows.push({ text: `${fmtPct(near[1])}  ${s.name}`, color: s.colour, v: near[1] })
  }
  rows.sort((a, b) => b.v - a.v)
  const poll = mPolls.value.find(p => Math.abs(p.t - snap) < 18 * 3600)
  mHover.value = { x: mx(snap), pts }
  show(e, fmtDateTime(new Date(snap * 1000).toISOString()), [...rows.map(({ text, color }) => ({ text, color })), ...(poll ? [{ text: `Straw poll ${poll.n}` }] : [])])
}
function mLeave() { mHover.value = null; hide() }

// ---- timeline ----
const KINDS = [
  { key: 'process', label: 'Process', color: BLUE },
  { key: 'nomination', label: 'Nominations', color: AQUA },
  { key: 'withdrawal', label: 'Withdrawals', color: RED },
  { key: 'dialogue', label: 'Dialogues', color: AMBER },
  { key: 'straw_poll', label: 'Straw polls', color: ORANGE },
  { key: 'milestone', label: 'Milestones', color: '#64748b' },
]
const kindOn = reactive<Record<string, boolean>>(Object.fromEntries(KINDS.map(k => [k.key, true])))
const kindColour = (k: string) => KINDS.find(x => x.key === k)?.color || '#64748b'
const kindLabel = (k: string) => (KINDS.find(x => x.key === k)?.label || k).replace(/s$/, '')
const timeline = computed(() => (d.value?.process.timeline || []).filter(e => kindOn[e.kind] !== false))

// ---- also mentioned ----
const STATUS: Record<string, [string, string]> = {
  likely: ['Likely nominee', 'bg-accent-100 text-accent-800'],
  expressed_interest: ['Expressed interest', 'bg-primary-100 text-primary-700'],
  rumoured: ['Rumoured', 'bg-primary-50 text-primary-600'],
  speculated: ['Speculated', 'bg-primary-50 text-primary-600'],
  ruled_out: ['Ruled out', 'bg-slate-100 text-slate-500'],
}
const statusLabel = (s: string | null) => (s && STATUS[s]?.[0]) || 'Mentioned'
const statusCls = (s: string | null) => (s && STATUS[s]?.[1]) || 'bg-primary-50 text-primary-600'

// ---- news ----
const newsFilter = ref('')
const newsLimit = ref(25)
watch(newsFilter, () => { newsLimit.value = 25 })
const newsFiltered = computed(() => {
  const all = d.value?.news || []
  const f = newsFilter.value
  if (!f) return all
  if (f.startsWith('m:')) return all.filter(n => n.also_mentioned.includes(f.slice(2)))
  return all.filter(n => n.candidates_mentioned.includes(f))
})
const newsShown = computed(() => newsFiltered.value.slice(0, newsLimit.value))
const countFor = (id: string) => (d.value?.news || []).filter(n => n.candidates_mentioned.includes(id)).length
const candName = (id: string) => d.value?.candidates.find(c => c.id === id)?.name.split(' ').slice(-1)[0] || id
const newsEl = ref<HTMLElement | null>(null)
function scrollToNews() { nextTick(() => newsEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }

// ---- formatting ----
function fmtDate(s: string | null | undefined, short = false) {
  if (!s) return ''
  const dt = new Date(s.length === 10 ? s + 'T12:00:00Z' : s)
  if (isNaN(dt.getTime())) return s
  return dt.toLocaleDateString('en-GB', short ? { day: 'numeric', month: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
function fmtDateTime(s: string) {
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? s : dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
}
function shortSource(s: { name: string; url: string }) {
  try {
    const host = new URL(s.url).hostname.replace(/^www\./, '')
    if (host.includes('wikipedia')) return 'Wikipedia'
    if (host.includes('1for8billion')) return '1 for 8 Billion'
    if (host.includes('securitycouncilreport')) return 'Security Council Report'
    if (host.includes('reuters')) return 'Reuters'
    if (host.includes('passblue')) return 'PassBlue'
    return host
  } catch { return s.name }
}

// ---- small sub-components (render functions keep this a single file) ----
const MiniBallot = defineComponent({
  props: { e: { type: Number, required: true }, dd: { type: Number, required: true }, n: { type: Number, required: true } },
  setup(p) {
    return () => h('div', {}, [
      h('div', { class: 'flex h-2.5 rounded-full overflow-hidden gap-[2px] bg-white', role: 'img', 'aria-label': `${p.e} encourage, ${p.dd} discourage, ${p.n} no opinion` }, [
        h('div', { style: { width: `${(p.e / 15) * 100}%`, background: AQUA } }),
        h('div', { style: { width: `${(p.n / 15) * 100}%`, background: GREY } }),
        h('div', { style: { width: `${(p.dd / 15) * 100}%`, background: RED } }),
      ]),
      h('div', { class: 'flex justify-between text-[11px] tabular-nums mt-0.5' }, [
        h('span', { style: { color: AQUA_TEXT } }, `${p.e} encourage`),
        h('span', { class: 'text-primary-400' }, `${p.n} no opinion`),
        h('span', { class: 'text-red-700' }, `${p.dd} discourage`),
      ]),
    ])
  },
})

const CandHead = defineComponent({
  props: { c: { type: Object as PropType<Cand>, required: true }, small: { type: Boolean, default: false } },
  setup(p) {
    const failed = ref(false)
    return () => {
      const c = p.c
      const src = failed.value ? c.photo_official : (c.photo || c.photo_official)
      const size = p.small ? 'w-11 h-11' : 'w-16 h-16'
      const nominators = (c.nominated_by_names || []).map((n, i) => {
        const iso2 = c.nominated_by_iso2?.[i] || iso2Of.value.get((c.nominated_by || [])[i]) || null
        return `${iso2 ? isoToFlag(iso2) + ' ' : ''}${n}`
      }).join(', ')
      const sameAsNat = (c.nominated_by || []).length === 1 && c.nominated_by[0] === c.nationality
      return h('div', { class: 'flex gap-3 items-start' }, [
        src
          ? h('img', { src: relayImage(src), alt: c.name, loading: 'lazy', referrerpolicy: 'no-referrer', class: `${size} rounded-full object-cover object-top bg-primary-100 shrink-0 ring-1 ring-primary-200`, onError: () => { failed.value = true } })
          : h('div', { class: `${size} rounded-full bg-primary-100 shrink-0 flex items-center justify-center font-serif text-primary-500` }, c.name.split(' ').map(x => x[0]).slice(0, 2).join('')),
        h('div', { class: 'min-w-0' }, [
          h('div', { class: `font-serif font-bold text-primary-900 leading-tight ${p.small ? 'text-base' : 'text-lg'}` }, [
            c.nationality_iso2 ? h('span', { class: 'mr-1', title: c.nationality_name || '' }, isoToFlag(c.nationality_iso2)) : null,
            c.name,
          ]),
          h('div', { class: 'text-xs text-primary-500 mt-0.5' }, [
            c.nationality_name || '',
            c.region_group_code ? ` · ${c.region_group_code}` : '',
            c.gender ? ` · ${c.gender === 'female' ? 'woman' : 'man'}` : '',
          ].join('')),
          h('div', { class: 'text-xs text-primary-600 mt-0.5' },
            `${sameAsNat ? 'Nominated by own government' : `Nominated by ${nominators || '–'}`}${c.nomination_date ? `, ${fmtDate(c.nomination_date)}` : ''}`),
        ]),
      ])
    }
  },
})
</script>
