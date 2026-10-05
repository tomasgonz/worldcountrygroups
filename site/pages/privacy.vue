<template>
  <div class="bg-primary-50/40 min-h-screen">
    <article class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">Privacy</p>
      <h1 class="font-serif text-4xl text-primary-900 mt-2">Privacy policy</h1>
      <p class="text-sm text-primary-500 mt-2">Last updated 5 October 2026</p>

      <div class="policy mt-8 bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 sm:p-8">
        <p class="lead">
          World Country Groups is a reference and analysis site about countries, international organisations and the United Nations.
          We collect as little personal data as we can, only for the purposes below. We do not sell data, show advertising, or use analytics, tracking or advertising cookies.
          This notice is written to meet the EU General Data Protection Regulation (GDPR) and the ePrivacy rules on cookies.
        </p>

        <h2>In short</h2>
        <ul>
          <li>Browsing the site does not build a profile of you: no analytics tools, no trackers, and no third-party scripts, fonts or images are loaded in your browser.</li>
          <li>If you have an account, we keep the details you gave us and what you save in the site.</li>
          <li>Visits through a shared link are counted in a limited, pseudonymous way for 90 days, and you can opt out with one click.</li>
          <li>You can see, download, correct or delete your data at any time.</li>
        </ul>

        <h2>1. Who is responsible</h2>
        <p>
          The controller of your personal data is the operator of World Country Groups (worldcountrygroups.org).
          You can contact us about anything in this notice using the <a href="#contact">form at the bottom of this page</a>; signed-in users can also download or delete their data from their <NuxtLink to="/account">account page</NuxtLink>.
          We have not appointed a data protection officer, as we are not required to.
        </p>

        <h2>2. What we collect, why, and on what legal basis</h2>
        <div class="overflow-x-auto">
          <table>
            <thead><tr><th>Purpose</th><th>Data</th><th>Legal basis (GDPR Art. 6)</th><th>Kept</th></tr></thead>
            <tbody>
              <tr><td>Running your account</td><td>Username, display name, email address (optional), password stored only as a salted hash, account status, registration date, settings and bookmarks</td><td>Contract (6(1)(b)): needed to provide the account you asked for</td><td>Until you delete your account</td></tr>
              <tr><td>Keeping you signed in</td><td>Session cookie <code>wcg_session</code></td><td>Contract (6(1)(b)); strictly necessary cookie</td><td>24 hours</td></tr>
              <tr><td>Answering your questions (research desk “Ask”)</td><td>Your questions, the answers, the date, and any review notes</td><td>Contract (6(1)(b))</td><td>Until you delete them or your account</td></tr>
              <tr><td>Email digests</td><td>Email address, countries you follow, what was last sent</td><td>Consent (6(1)(a)): only if you switch digests on; you can switch them off at any time</td><td>Until you switch them off or delete your account</td></tr>
              <tr><td>Statistics on shared links</td><td>See section 4</td><td>Legitimate interests (6(1)(f)): knowing whether shared pages are used and keeping links secure</td><td>90 days</td></tr>
              <tr><td>Answering data-protection requests</td><td>Your email address, name if given, and your message</td><td>Legal obligation (6(1)(c))</td><td>Up to 3 years after the request is closed</td></tr>
              <tr><td>Security and error logs</td><td>The address of a page that failed and the time, without information about who requested it</td><td>Legitimate interests (6(1)(f)): keeping the site working and secure</td><td>30 days</td></tr>
              <tr><td>Backups</td><td>Encrypted copies of the above</td><td>Legitimate interests (6(1)(f)): not losing data</td><td>Up to 12 months on a rolling basis</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Giving us your data is voluntary. To have an account you need a username and password; an email address is optional and only needed for digests.
          We do not make any decisions about you by automated means, including profiling.
        </p>

        <h2>3. Browsing the site</h2>
        <p>
          The site does not record the IP addresses or browsing of ordinary visitors. Portraits of public figures from Wikimedia Commons and the United Nations are fetched by our server and passed on to you,
          so your browser does not contact those sites. Links to other websites (for example UN documents or news articles) take you to sites with their own privacy policies.
          Our hosting provider's network passes requests to us and may keep short-lived technical logs (see section 6).
        </p>

        <h2>4. Shared links</h2>
        <p>Pages can be shared, through a link, with people who do not have an account. When such a link is used we keep a minimal, pseudonymous record:</p>
        <ul>
          <li>the date and time, and which pages of the shared view were opened;</li>
          <li>the network part of the IP address only (the last part is removed, so 203.0.113.57 is kept as 203.0.113.0);</li>
          <li>the browser family and type of device (for example “Safari, phone”), the main language setting (for example “en”), and the name of the site the link was opened from (for example a messaging app);</li>
          <li>a code that groups one visitor's clicks on the same day. It is calculated on our server, is not stored on your device, and changes every day, so visits on different days cannot be linked.</li>
        </ul>
        <p>
          We do not record full IP addresses or browser details and we do not use cookies or other identifiers to recognise you across visits.
          You can object at any time: choose “Don't count my visit” in the note at the bottom of a shared page, and nothing further is recorded about your visits.
          These records are seen only by the site's administrators and deleted after 90 days.
        </p>

        <h2>5. Cookies and similar storage</h2>
        <p>We use only cookies that are strictly necessary for the site to work or to remember a choice you made, so no consent banner is needed. We use no analytics, advertising or third-party cookies.</p>
        <div class="overflow-x-auto">
          <table>
            <thead><tr><th>Name</th><th>Purpose</th><th>Duration</th></tr></thead>
            <tbody>
              <tr><td><code>wcg_session</code></td><td>Keeps you signed in</td><td>24 hours</td></tr>
              <tr><td><code>wcg_share</code></td><td>Remembers which shared page a link lets you open; contains only the link code</td><td>Until the link expires (at most 90 days)</td></tr>
              <tr><td><code>wcg_nostats</code></td><td>Remembers that you objected to shared-link statistics</td><td>1 year</td></tr>
              <tr><td><code>wcg-share-notice</code> (local storage)</td><td>Remembers that you have seen the privacy note on shared pages</td><td>Until you clear your browser data</td></tr>
            </tbody>
          </table>
        </div>

        <h2>6. Who else handles data (processors) and transfers outside the EU</h2>
        <p>We use a small number of service providers, under contracts that oblige them to process data only on our instructions:</p>
        <ul>
          <li><strong>exe.dev</strong>: hosts the site and its network, and delivers our emails (digests and notifications).</li>
          <li><strong>OpenAI</strong> (United States): produces answers for the research desk. Your question and relevant information from our database are sent through OpenAI's API. Under OpenAI's business terms this content is not used to train its models and is kept only for a limited period for abuse monitoring. Please don't include personal or confidential information in questions.</li>
          <li><strong>Wasabi</strong> (data centre in the United States): stores our backups, encrypted before they leave our server with a key only we hold, so Wasabi cannot read them.</li>
          <li><strong>Cloudflare</strong>: provides the domain name service for worldcountrygroups.org. It does not receive the content of your visits.</li>
        </ul>
        <p>
          Where personal data is transferred to a country outside the European Economic Area, such as the United States, we rely on the European Commission's adequacy decision for the EU–US Data Privacy Framework where the provider is certified under it,
          and otherwise on the European Commission's Standard Contractual Clauses included in the provider's data processing terms. You can ask us for a copy of the relevant safeguards.
        </p>

        <h2>7. Information about public figures</h2>
        <p>
          The site shows information about heads of state and government, ministers, diplomats, UN officials and candidates for UN posts, in connection with their public roles:
          names, positions, official photographs, speeches, public statements and news coverage. It comes from public sources such as the United Nations, Wikidata and Wikimedia Commons, official government websites and news reports, and each item links to its source.
          We process it on the basis of legitimate interests (6(1)(f)) in providing research and analysis of international affairs. If you are one of these people and think something is wrong or should not be shown, use the form below; you may object, and we will review the request promptly.
        </p>

        <h2>8. Your rights</h2>
        <p>Under the GDPR you have the right to:</p>
        <ul>
          <li><strong>access</strong> your data and receive a copy (signed-in users: “Download my data” on the account page);</li>
          <li><strong>correct</strong> inaccurate data;</li>
          <li><strong>delete</strong> your data (signed-in users: “Delete my account” on the account page);</li>
          <li><strong>restrict</strong> how we use your data;</li>
          <li><strong>data portability</strong>: receive your data in a machine-readable format (the download is in JSON);</li>
          <li><strong>object</strong> to processing based on legitimate interests, including shared-link statistics;</li>
          <li><strong>withdraw consent</strong> at any time, for example by switching off email digests, without affecting what was done before;</li>
          <li><strong>complain</strong> to a data protection authority, in particular in the EU country where you live or work. A list of authorities is on the <a href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener">European Data Protection Board's website</a>.</li>
        </ul>
        <p>We answer requests within one month (this can be extended by two further months for complex requests, in which case we will tell you). Requests are free of charge.</p>

        <h2>9. Security</h2>
        <p>
          Connections to the site are encrypted (HTTPS). Passwords are stored only as salted hashes. Access to personal data is limited to the site's administrators. Backups are encrypted.
          If a personal data breach occurs that is likely to put your rights at risk, we will notify the competent authority within 72 hours and inform you where required.
        </p>

        <h2>10. Children</h2>
        <p>The site is intended for adults working on international affairs and is not directed at children under 16.</p>

        <h2>11. Changes</h2>
        <p>If we change how we handle personal data, we will update this page and the date at the top, and tell account holders by email about significant changes.</p>

        <h2 id="contact">12. Contact us about your data</h2>
        <form v-if="!sent" class="space-y-3 mt-3" @submit.prevent="send">
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="text-sm text-primary-600">Your email address (so we can reply)
              <input v-model="req.email" type="email" required autocomplete="email" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
            </label>
            <label class="text-sm text-primary-600">Your name (optional)
              <input v-model="req.name" autocomplete="name" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
            </label>
          </div>
          <label class="block text-sm text-primary-600">What would you like to do?
            <select v-model="req.type" class="mt-1 w-full sm:w-72 border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white">
              <option value="access">Get a copy of my data</option>
              <option value="correction">Correct my data</option>
              <option value="deletion">Delete my data</option>
              <option value="objection">Object to how my data is used</option>
              <option value="restriction">Restrict how my data is used</option>
              <option value="portability">Receive my data to move it elsewhere</option>
              <option value="question">Ask a question</option>
            </select>
          </label>
          <label class="block text-sm text-primary-600">Your request
            <textarea v-model="req.message" rows="4" required minlength="10" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-2 text-sm" placeholder="Tell us what it concerns, e.g. your account name or the page about you." />
          </label>
          <input v-model="req.website" type="text" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
          <p class="text-xs text-primary-500">We use what you send only to answer your request (legal basis: legal obligation), and keep it for up to three years after the request is closed.</p>
          <button class="px-4 py-2 rounded-lg bg-primary-900 text-white text-sm hover:bg-primary-800 disabled:opacity-50" :disabled="sending">{{ sending ? 'Sending…' : 'Send request' }}</button>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </form>
        <p v-else class="mt-3 text-sm text-emerald-700">Thank you. We have received your request and will answer by email within one month.</p>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Privacy policy — World Country Groups' })
const req = reactive({ email: '', name: '', type: 'access', message: '', website: '' })
const sending = ref(false)
const sent = ref(false)
const error = ref('')
async function send() {
  sending.value = true; error.value = ''
  try {
    await $fetch('/api/privacy-request', { method: 'POST', body: { ...req } })
    sent.value = true
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not send the request; please try again'
  } finally { sending.value = false }
}
</script>

<style scoped>
.policy :deep(h2) { @apply font-serif text-xl text-primary-900 mt-8 mb-2; }
.policy :deep(p) { @apply text-[15px] leading-7 text-primary-700 mt-3; }
.policy :deep(.lead) { @apply text-base text-primary-800 mt-0; }
.policy :deep(ul) { @apply list-disc pl-5 mt-3 space-y-1.5 text-[15px] leading-7 text-primary-700; }
.policy :deep(a) { @apply text-accent-700 underline; }
.policy :deep(code) { @apply text-[13px] bg-primary-50 px-1 rounded; }
.policy :deep(table) { @apply w-full text-sm mt-3; }
.policy :deep(th) { @apply text-left font-medium text-primary-500 border-b border-primary-100 py-2 pr-4; }
.policy :deep(td) { @apply border-b border-primary-50 py-2 pr-4 text-primary-700 align-top; }
</style>
