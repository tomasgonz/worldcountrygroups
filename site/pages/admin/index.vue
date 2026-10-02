<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between mb-8">
      <h1 class="font-serif text-3xl font-bold text-primary-900">Admin Dashboard</h1>
      <button
        @click="handleLogout"
        class="text-sm text-primary-400 hover:text-primary-900 transition-colors"
      >
        Logout
      </button>
    </div>

    <!-- ═══ CONTENT MANAGEMENT ═══ -->
    <div class="flex items-center gap-3 mb-4">
      <div class="h-px flex-1 bg-primary-100"></div>
      <span class="text-xs font-medium text-primary-400 uppercase tracking-widest">Content</span>
      <div class="h-px flex-1 bg-primary-100"></div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <!-- Group Management -->
      <NuxtLink to="/admin/groups" class="block bg-white rounded-2xl border border-primary-100 p-5 hover:border-primary-300 transition-colors group">
        <h2 class="font-serif text-lg font-bold text-primary-900 group-hover:text-primary-700">Groups</h2>
        <p class="text-sm text-primary-500 mt-1">{{ groupCount }} groups</p>
      </NuxtLink>

      <!-- News Sources card  -->
      <div class="bg-white rounded-2xl border border-primary-100 p-5">
        <h2 class="font-serif text-lg font-bold text-primary-900">News Feed</h2>
        <p class="text-sm text-primary-500 mt-1">{{ newsFeedStats.articles }} articles &middot; {{ newsFeedStats.enabledSources }}/{{ newsFeedStats.totalSources }} sources</p>
      </div>

      <!-- Statement Sources card -->
      <NuxtLink to="/admin/statements" class="block bg-white rounded-2xl border border-primary-100 p-5 hover:border-primary-300 transition-colors group">
        <h2 class="font-serif text-lg font-bold text-primary-900 group-hover:text-primary-700">Statements</h2>
        <p class="text-sm text-primary-500 mt-1">{{ stmtFeedStats.statements }} statements &middot; {{ stmtFeedStats.totalSources }} sources</p>
      </NuxtLink>
    </div>

    <!-- ═══ AI & INTELLIGENCE ═══ -->
    <div class="flex items-center gap-3 mb-4">
      <div class="h-px flex-1 bg-primary-100"></div>
      <span class="text-xs font-medium text-primary-400 uppercase tracking-widest">AI & Intelligence</span>
      <div class="h-px flex-1 bg-primary-100"></div>
    </div>

    <!-- AI Configuration -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">AI Configuration</h2>
      <div class="flex items-center gap-3 mb-4">
        <span v-if="aiConfig?.activeProvider" class="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full">
          <span class="w-2 h-2 bg-green-500 rounded-full"></span>
          Active: {{ aiConfig.providers.find((p: any) => p.id === aiConfig.activeProvider)?.name || aiConfig.activeProvider }}
        </span>
        <span v-else class="inline-flex items-center gap-1.5 text-sm text-primary-400 bg-primary-50 px-3 py-1 rounded-full">
          <span class="w-2 h-2 bg-primary-300 rounded-full"></span>
          No provider configured
        </span>
      </div>

      <!-- Provider List -->
      <div v-if="aiConfig?.providers?.length" class="space-y-2 mb-4">
        <div v-for="p in aiConfig.providers" :key="p.id" class="border rounded-xl" :class="p.id === aiConfig.activeProvider ? 'border-green-200 bg-green-50/30' : 'border-primary-100'">
          <div class="flex flex-wrap items-center justify-between gap-2 p-3">
            <div class="min-w-0">
              <span class="text-sm font-medium text-primary-800">{{ p.name }}</span>
              <code class="text-xs text-primary-500 ml-2 bg-primary-50 px-1.5 py-0.5 rounded">{{ p.model }}</code>
              <span v-if="p.id === aiConfig.activeProvider" class="text-xs text-green-700 ml-2">active</span>
              <span v-if="!p.enabled" class="text-xs text-amber-700 ml-2">disabled</span>
              <div class="text-[11px] text-primary-400 mt-0.5">{{ p.type }} &middot; key {{ p.apiKey }}<span v-if="p.baseUrl"> &middot; {{ p.baseUrl }}</span></div>
              <div v-if="aiTest[p.id]" class="text-[11px] mt-1" :class="aiTest[p.id].ok ? 'text-green-700' : 'text-red-600'">
                {{ aiTest[p.id].running ? 'Testing…' : aiTest[p.id].ok ? `Works: replied “${aiTest[p.id].reply}” in ${(aiTest[p.id].ms / 1000).toFixed(1)}s` : `Failed: ${aiTest[p.id].error}` }}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100" @click="testAI(p.id)">Test</button>
              <button class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100" @click="startEditAI(p)">{{ aiEditing === p.id ? 'Close' : 'Edit / change model' }}</button>
              <button class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100" @click="startDupAI(p)">{{ aiDupFor === p.id ? 'Close' : '+ Model with this key' }}</button>
              <button v-if="p.id !== aiConfig.activeProvider" @click="setActiveAI(p.id)" class="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Set active</button>
              <button @click="removeAIProvider(p.id)" class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Remove</button>
            </div>
          </div>

          <!-- Edit -->
          <div v-if="aiEditing === p.id" class="border-t border-primary-100 p-3 space-y-3">
            <div class="grid sm:grid-cols-2 gap-3">
              <label class="block"><span class="block text-xs text-primary-500 mb-1">Display name</span>
                <input v-model="aiEdit.name" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm"></label>
              <label class="block"><span class="block text-xs text-primary-500 mb-1">Model</span>
                <div class="flex gap-1.5">
                  <input v-model="aiEdit.model" :list="`models-${p.id}`" class="flex-1 min-w-0 border border-primary-200 rounded-lg px-3 py-1.5 text-sm font-mono" placeholder="e.g. gpt-5">
                  <button class="text-xs px-2 rounded-lg ring-1 ring-primary-200 hover:bg-primary-50 whitespace-nowrap" @click="loadModels(p.id)">{{ aiModels[p.id]?.loading ? '…' : 'List models' }}</button>
                </div>
                <datalist :id="`models-${p.id}`"><option v-for="m in aiModels[p.id]?.list || []" :key="m.id" :value="m.id">{{ m.label }}</option></datalist>
              </label>
            </div>
            <div v-if="aiModels[p.id]?.list?.length" class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              <button v-for="m in aiModels[p.id].list" :key="m.id" class="text-[11px] px-2 py-0.5 rounded-full ring-1 font-mono"
                :class="aiEdit.model === m.id ? 'bg-primary-900 text-white ring-primary-900' : 'ring-primary-200 text-primary-600 hover:ring-primary-400'" @click="aiEdit.model = m.id">{{ m.id }}</button>
            </div>
            <p v-if="aiModels[p.id]?.error" class="text-[11px] text-red-600">Could not list models: {{ aiModels[p.id].error }}</p>
            <div class="grid sm:grid-cols-3 gap-3">
              <label class="block"><span class="block text-xs text-primary-500 mb-1">Temperature (optional)</span>
                <input v-model="aiEdit.temperature" type="number" step="0.1" min="0" max="2" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="default"></label>
              <label class="block"><span class="block text-xs text-primary-500 mb-1">Max output tokens (optional)</span>
                <input v-model="aiEdit.maxTokens" type="number" min="256" step="256" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="default"></label>
              <label class="block"><span class="block text-xs text-primary-500 mb-1">Replace API key (optional)</span>
                <input v-model="aiEdit.apiKey" type="password" autocomplete="new-password" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="leave blank to keep"></label>
            </div>
            <label v-if="p.type !== 'openai'" class="block"><span class="block text-xs text-primary-500 mb-1">Base URL</span>
              <input v-model="aiEdit.baseUrl" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="default"></label>
            <p class="text-[11px] text-primary-400">Reasoning models (gpt-5, o-series) ignore temperature and need a larger token budget.</p>
            <div class="flex items-center gap-2">
              <button class="text-sm px-4 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800" @click="saveEditAI(p.id)">Save</button>
              <button class="text-sm px-4 py-1.5 rounded-lg ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50" @click="saveEditAI(p.id, true)">Save &amp; test</button>
              <span v-if="aiMsg" class="text-xs" :class="aiMsg.startsWith('Error') ? 'text-red-600' : 'text-green-700'">{{ aiMsg }}</span>
            </div>
          </div>

          <!-- Add another model with the same key -->
          <div v-if="aiDupFor === p.id" class="border-t border-primary-100 p-3 space-y-3">
            <p class="text-xs text-primary-500">Creates a second configuration that uses the same {{ p.type }} key, so you can switch between models without re-entering it.</p>
            <div class="grid sm:grid-cols-2 gap-3">
              <label class="block"><span class="block text-xs text-primary-500 mb-1">Model</span>
                <div class="flex gap-1.5">
                  <input v-model="aiDup.model" :list="`models-${p.id}`" class="flex-1 min-w-0 border border-primary-200 rounded-lg px-3 py-1.5 text-sm font-mono" placeholder="e.g. gpt-4.1">
                  <button class="text-xs px-2 rounded-lg ring-1 ring-primary-200 hover:bg-primary-50 whitespace-nowrap" @click="loadModels(p.id)">{{ aiModels[p.id]?.loading ? '…' : 'List models' }}</button>
                </div>
                <datalist :id="`models-${p.id}`"><option v-for="m in aiModels[p.id]?.list || []" :key="m.id" :value="m.id" /></datalist>
              </label>
              <label class="block"><span class="block text-xs text-primary-500 mb-1">Display name (optional)</span>
                <input v-model="aiDup.name" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" :placeholder="aiDup.model ? `OpenAI ${aiDup.model}` : ''"></label>
            </div>
            <div v-if="aiModels[p.id]?.list?.length" class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              <button v-for="m in aiModels[p.id].list" :key="m.id" class="text-[11px] px-2 py-0.5 rounded-full ring-1 font-mono"
                :class="aiDup.model === m.id ? 'bg-primary-900 text-white ring-primary-900' : 'ring-primary-200 text-primary-600 hover:ring-primary-400'" @click="aiDup.model = m.id">{{ m.id }}</button>
            </div>
            <label class="flex items-center gap-1.5 text-xs text-primary-600"><input v-model="aiDup.activate" type="checkbox" class="rounded"> Make it the active model</label>
            <div class="flex items-center gap-2">
              <button class="text-sm px-4 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-40" :disabled="!aiDup.model" @click="saveDupAI(p.id)">Add model</button>
              <span v-if="aiMsg" class="text-xs" :class="aiMsg.startsWith('Error') ? 'text-red-600' : 'text-green-700'">{{ aiMsg }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Provider Form -->
      <div v-if="showAIForm" class="border border-primary-200 rounded-xl p-4 mb-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-primary-500 mb-1">Provider ID</label>
            <input v-model="aiForm.id" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="openai">
          </div>
          <div>
            <label class="block text-xs text-primary-500 mb-1">Display Name</label>
            <input v-model="aiForm.name" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="OpenAI GPT-4o">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-primary-500 mb-1">Type</label>
            <select v-model="aiForm.type" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai-compatible">OpenAI-Compatible</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-primary-500 mb-1">Model</label>
            <input v-model="aiForm.model" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="gpt-4o">
          </div>
        </div>
        <div>
          <label class="block text-xs text-primary-500 mb-1">API Key</label>
          <input v-model="aiForm.apiKey" type="password" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="sk-...">
        </div>
        <div v-if="aiForm.type === 'openai-compatible'">
          <label class="block text-xs text-primary-500 mb-1">Base URL</label>
          <input v-model="aiForm.baseUrl" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="https://api.example.com/v1">
        </div>
        <div class="flex gap-2">
          <button @click="addAIProvider" class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800">Add Provider</button>
          <button @click="showAIForm = false" class="text-sm px-4 py-2 rounded-lg bg-primary-100 text-primary-600">Cancel</button>
        </div>
      </div>

      <button v-if="!showAIForm" @click="showAIForm = true" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50">
        + Add Provider
      </button>

      <!-- Prompt Configuration -->
      <div class="border-t border-primary-100 mt-6 pt-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-primary-800">Analysis Prompts</h3>
          <button @click="showPromptEditor = !showPromptEditor" class="text-xs text-primary-400 hover:text-primary-600">
            {{ showPromptEditor ? 'Hide' : 'Edit' }}
          </button>
        </div>
        <p class="text-xs text-primary-400 mb-3">Customize the instructions sent to the AI for each analysis type. Leave blank to use defaults.</p>

        <div v-if="showPromptEditor" class="space-y-6">
          <div v-for="group in promptGroups" :key="group.label">
            <button
              @click="togglePromptGroup(group.label)"
              class="flex items-center gap-2 w-full text-left text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3 hover:text-primary-800"
            >
              <svg class="w-3 h-3 transition-transform" :class="expandedPromptGroups.includes(group.label) ? 'rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              {{ group.label }}
            </button>
            <div v-if="expandedPromptGroups.includes(group.label)" class="space-y-4 pl-5 border-l-2 border-primary-100">
              <div v-for="field in group.fields" :key="field.key">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-medium text-primary-500">{{ field.label }}</label>
                  <button
                    @click="toggleDefaultView(field.key)"
                    class="text-xs text-primary-400 hover:text-primary-600"
                  >
                    {{ showingDefaults.includes(field.key) ? 'Hide Default' : 'View Default' }}
                  </button>
                </div>
                <textarea
                  v-model="(promptForm as any)[field.key]"
                  rows="4"
                  class="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm text-primary-700 font-mono"
                  :placeholder="(promptDefaults as any)[field.key]?.slice(0, 80) + '...'"
                ></textarea>
                <pre
                  v-if="showingDefaults.includes(field.key)"
                  class="mt-2 p-3 bg-primary-50 border border-primary-100 rounded-lg text-xs text-primary-600 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto"
                >{{ (promptDefaults as any)[field.key] }}</pre>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="savePrompts" class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800">Save Prompts</button>
            <button @click="resetPrompts" class="text-sm px-4 py-2 rounded-lg bg-primary-100 text-primary-600">Reset to Defaults</button>
          </div>
        </div>
      </div>

      <!-- Pulse Briefing Style -->
      <div class="border-t border-primary-100 mt-6 pt-6">
        <h3 class="text-sm font-semibold text-primary-800 mb-3">Pulse Briefing Style</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-primary-500 mb-2">Tone</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in pulseToneOptions"
                :key="t.value"
                class="px-3 py-1.5 rounded-lg text-xs border transition-colors"
                :class="pulseStyle.tone === t.value ? 'bg-primary-900 text-white border-primary-900' : 'bg-white text-primary-700 border-primary-200 hover:border-primary-400'"
                @click="pulseStyle.tone = t.value"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-primary-500 mb-1">
              Temperature: {{ pulseStyle.temperature.toFixed(1) }}
            </label>
            <div class="flex items-center gap-3">
              <span class="text-xs text-primary-400">Precise</span>
              <input type="range" min="0" max="1.5" step="0.1" v-model.number="pulseStyle.temperature" class="flex-1 accent-primary-700" />
              <span class="text-xs text-primary-400">Creative</span>
            </div>
          </div>
          <button @click="savePulseStyle" class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800">Save Style</button>
          <span v-if="pulseStyleMsg" class="text-xs ml-3" :class="pulseStyleMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'">{{ pulseStyleMsg }}</span>
        </div>
      </div>
    </div>

    <!-- AI Analysis Cache -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">AI Analysis Cache</h2>

      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-2">
          <label class="text-sm text-primary-600">Max age (hours):</label>
          <input
            v-model.number="cacheMaxAge"
            type="number"
            min="1"
            class="w-20 border border-primary-200 rounded-lg px-2 py-1 text-sm"
          >
          <button @click="saveCacheMaxAge" class="text-xs px-3 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800">Save</button>
        </div>
        <span class="text-xs text-primary-400">{{ cacheStats?.totalEntries || 0 }} cached entries</span>
      </div>

      <div v-if="cacheStats?.entries?.length" class="space-y-2 mb-4">
        <div v-for="entry in cacheStats.entries" :key="entry.key" class="flex items-center justify-between border border-primary-100 rounded-lg p-3">
          <div>
            <span class="text-sm font-medium text-primary-800">{{ entry.key }}</span>
            <span class="text-xs text-primary-400 ml-2">{{ entry.provider }} / {{ entry.model }}</span>
            <span class="text-xs ml-2" :class="entry.expired ? 'text-red-500' : 'text-green-600'">
              {{ entry.expired ? 'expired' : formatTime(entry.generatedAt) }}
            </span>
          </div>
          <button @click="clearCacheEntry(entry.key)" class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Clear</button>
        </div>
      </div>
      <div v-else class="text-sm text-primary-400 mb-4">No cached analyses.</div>

      <div class="flex gap-2">
        <button @click="clearAllCache" class="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Clear All</button>
      </div>
    </div>

    <!-- ═══ SCHEDULING ═══ -->
    <div class="flex items-center gap-3 mb-4">
      <div class="h-px flex-1 bg-primary-100"></div>
      <span class="text-xs font-medium text-primary-400 uppercase tracking-widest">Scheduling</span>
      <div class="h-px flex-1 bg-primary-100"></div>
    </div>

    <!-- Scheduled Jobs -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-serif text-xl font-bold text-primary-900">Scheduled Jobs</h2>
        <button @click="showCronForm = true; editingCronId = null; Object.assign(cronForm, { id: '', label: '', script: '', schedule: '0 */6 * * *', logFile: '' })" v-if="!showCronForm" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50">
          + Add Job
        </button>
      </div>

      <!-- Add/Edit Form -->
      <div v-if="showCronForm" class="border border-primary-200 rounded-xl p-4 mb-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-primary-500 mb-1">Job ID</label>
            <input v-model="cronForm.id" :disabled="!!editingCronId" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm disabled:bg-primary-50" placeholder="fetch-custom">
          </div>
          <div>
            <label class="block text-xs text-primary-500 mb-1">Label</label>
            <input v-model="cronForm.label" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="Custom Data Feed">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-primary-500 mb-1">Script Path</label>
            <input v-model="cronForm.script" :disabled="!!editingCronId" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm disabled:bg-primary-50" placeholder="scripts/fetch_custom.py">
          </div>
          <div>
            <label class="block text-xs text-primary-500 mb-1">Schedule (cron)</label>
            <input v-model="cronForm.schedule" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm font-mono" placeholder="0 */6 * * *">
          </div>
        </div>
        <div>
          <label class="block text-xs text-primary-500 mb-1">Log File</label>
          <input v-model="cronForm.logFile" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="/tmp/fetch-custom.log">
        </div>
        <div class="flex gap-2">
          <button @click="saveCronJob" class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800">{{ editingCronId ? 'Update' : 'Add' }} Job</button>
          <button @click="showCronForm = false" class="text-sm px-4 py-2 rounded-lg bg-primary-100 text-primary-600">Cancel</button>
        </div>
      </div>

      <!-- Jobs Table -->
      <div v-if="cronJobs.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-primary-100 text-left">
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Job</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Schedule</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Last Run</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Status</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in cronJobs" :key="job.id" class="border-b border-primary-50 last:border-0">
              <td class="px-3 py-2.5">
                <div class="text-primary-800 font-medium">{{ job.label }}</div>
                <div class="text-xs text-primary-400">{{ job.script }}</div>
              </td>
              <td class="px-3 py-2.5 text-primary-600 font-mono text-xs">{{ job.schedule }}</td>
              <td class="px-3 py-2.5">
                <div v-if="job.lastRun" class="text-xs text-primary-500">{{ formatTime(job.lastRun) }}</div>
                <div v-else class="text-xs text-primary-300">Never</div>
                <div v-if="job.lastError" class="text-xs text-red-500 truncate max-w-[200px]" :title="job.lastError">{{ job.lastError }}</div>
              </td>
              <td class="px-3 py-2.5">
                <span :class="job.enabled ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-400'" class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ job.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <button
                    @click="toggleCronJob(job.id, !job.enabled)"
                    class="text-xs px-2.5 py-1 rounded transition-colors"
                    :class="job.enabled ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'"
                  >
                    {{ job.enabled ? 'Disable' : 'Enable' }}
                  </button>
                  <button
                    @click="runCronJob(job.id)"
                    :disabled="runningCronJob === job.id"
                    class="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    {{ runningCronJob === job.id ? 'Running...' : 'Run Now' }}
                  </button>
                  <button
                    @click="editCronJob(job)"
                    class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    @click="deleteCronJob(job.id)"
                    class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-sm text-primary-400">No scheduled jobs configured.</div>

      <!-- Status message -->
      <div v-if="cronMessage" class="mt-4 rounded-lg px-4 py-3 text-sm" :class="cronMessage.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
        {{ cronMessage.text }}
      </div>
    </div>

    <!-- ═══ NEWS & FEEDS ═══ -->
    <div class="flex items-center gap-3 mb-4">
      <div class="h-px flex-1 bg-primary-100"></div>
      <span class="text-xs font-medium text-primary-400 uppercase tracking-widest">News & Feeds</span>
      <div class="h-px flex-1 bg-primary-100"></div>
    </div>

    <!-- News Feed Status -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">News Feed Status</h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="border border-primary-100 rounded-xl p-4 text-center">
          <div class="text-2xl font-serif font-bold text-primary-900">{{ newsFeedStats.articles }}</div>
          <div class="text-xs text-primary-400 mt-1">Articles</div>
        </div>
        <div class="border border-primary-100 rounded-xl p-4 text-center">
          <div class="text-2xl font-serif font-bold text-primary-900">{{ newsFeedStats.sources }}</div>
          <div class="text-xs text-primary-400 mt-1">Active Sources</div>
        </div>
        <div class="border border-primary-100 rounded-xl p-4 text-center">
          <div class="text-2xl font-serif font-bold text-primary-900">{{ newsFeedStats.countries }}</div>
          <div class="text-xs text-primary-400 mt-1">Countries Covered</div>
        </div>
        <div class="border border-primary-100 rounded-xl p-4 text-center">
          <div class="text-2xl font-serif font-bold text-primary-900">{{ newsFeedStats.sizeKB }} KB</div>
          <div class="text-xs text-primary-400 mt-1">Feed Size</div>
        </div>
      </div>
      <div class="flex items-center justify-between mt-4 text-xs text-primary-400">
        <span v-if="newsFeedStats.lastUpdated">Last updated: {{ formatTime(newsFeedStats.lastUpdated) }}</span>
        <span v-else>No data yet</span>
        <span>{{ newsFeedStats.enabledSources }} of {{ newsFeedStats.totalSources }} sources enabled</span>
      </div>
    </div>

    <!-- News Sources -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-serif text-xl font-bold text-primary-900">News Sources</h2>
        <button @click="showNewsForm = true; Object.assign(newsForm, { id: '', name: '', url: '', type: 'rss', category: 'wire' })" v-if="!showNewsForm" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50">
          + Add Source
        </button>
      </div>

      <!-- Add Source Form -->
      <div v-if="showNewsForm" class="border border-primary-200 rounded-xl p-4 mb-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-primary-500 mb-1">Source ID</label>
            <input v-model="newsForm.id" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="my-source">
          </div>
          <div>
            <label class="block text-xs text-primary-500 mb-1">Name</label>
            <input v-model="newsForm.name" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="My News Source">
          </div>
        </div>
        <div>
          <label class="block text-xs text-primary-500 mb-1">URL</label>
          <input v-model="newsForm.url" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="https://example.com/feed/">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-primary-500 mb-1">Type</label>
            <select v-model="newsForm.type" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="rss">RSS</option>
              <option value="atom">Atom</option>
              <option value="json-api">JSON API</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-primary-500 mb-1">Category</label>
            <select v-model="newsForm.category" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="government">Government</option>
              <option value="wire">Wire / Diplomatic</option>
              <option value="institutional">Institutional</option>
              <option value="regional">Regional</option>
              <option value="lldc-sids">LLDC / SIDS</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="addNewSource" class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800">Add Source</button>
          <button @click="testNewsUrl" :disabled="testingNewsUrl" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 disabled:opacity-50">
            {{ testingNewsUrl ? 'Testing...' : 'Test URL' }}
          </button>
          <button @click="showNewsForm = false" class="text-sm px-4 py-2 rounded-lg bg-primary-100 text-primary-600">Cancel</button>
        </div>
        <div v-if="newsTestResult" class="text-xs rounded-lg px-3 py-2" :class="newsTestResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
          {{ newsTestResult.ok ? `OK — ${newsTestResult.format} format, ${newsTestResult.size} bytes` : `Error: ${newsTestResult.error}` }}
        </div>
      </div>

      <!-- Sources Table -->
      <div v-if="newsSources.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-primary-100 text-left">
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Source</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Category</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Articles</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Last Fetch</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Status</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="src in newsSources" :key="src.id" class="border-b border-primary-50 last:border-0">
              <td class="px-3 py-2.5">
                <div class="text-primary-800 font-medium">{{ src.name }}</div>
                <div class="text-xs text-primary-400 truncate max-w-[250px]" :title="src.url">{{ src.url }}</div>
              </td>
              <td class="px-3 py-2.5">
                <span class="text-xs px-2 py-0.5 rounded-full" :class="newsCategoryClass(src.category)">{{ src.category }}</span>
              </td>
              <td class="px-3 py-2.5 text-primary-600 tabular-nums text-xs">{{ src.articleCount || 0 }}</td>
              <td class="px-3 py-2.5">
                <div v-if="src.lastFetch" class="text-xs text-primary-500">{{ formatTime(src.lastFetch) }}</div>
                <div v-else class="text-xs text-primary-300">Never</div>
                <div v-if="src.lastError" class="text-xs text-red-500 truncate max-w-[200px]" :title="src.lastError">{{ src.lastError }}</div>
              </td>
              <td class="px-3 py-2.5">
                <span :class="src.enabled ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-400'" class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ src.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <button
                    @click="toggleNewsSource(src.id, !src.enabled)"
                    class="text-xs px-2.5 py-1 rounded transition-colors"
                    :class="src.enabled ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'"
                  >
                    {{ src.enabled ? 'Disable' : 'Enable' }}
                  </button>
                  <button
                    @click="deleteNewsSource(src.id)"
                    class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-sm text-primary-400">No news sources configured.</div>

      <div v-if="newsMessage" class="mt-4 rounded-lg px-4 py-3 text-sm" :class="newsMessage.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
        {{ newsMessage.text }}
      </div>
    </div>

    <!-- ═══ SITE SETTINGS ═══ -->
    <div class="flex items-center gap-3 mb-4">
      <div class="h-px flex-1 bg-primary-100"></div>
      <span class="text-xs font-medium text-primary-400 uppercase tracking-widest">Site Settings</span>
      <div class="h-px flex-1 bg-primary-100"></div>
    </div>

    <!-- Site Mode -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Site Access Mode</h2>
      <p class="text-sm text-primary-500 mb-4">
        <strong>Public:</strong> All pages accessible without login.
        <strong>Restricted:</strong> Only homepage, about, and sources are public; everything else requires login.
      </p>
      <div class="flex items-center gap-3">
        <button
          @click="toggleSiteMode('public')"
          :class="siteMode === 'public' ? 'bg-green-600 text-white' : 'bg-primary-100 text-primary-600'"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Public
        </button>
        <button
          @click="toggleSiteMode('restricted')"
          :class="siteMode === 'restricted' ? 'bg-amber-600 text-white' : 'bg-primary-100 text-primary-600'"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Restricted
        </button>
      </div>
    </div>

    <!-- Navigation Links -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Navigation Links</h2>
      <p class="text-sm text-primary-500 mb-4">
        Disable pages to hide them from the navigation bar for non-admin users.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="page in toggleablePages"
          :key="page.path"
          @click="togglePage(page.path)"
          class="text-sm px-4 py-2 rounded-lg font-medium transition-colors border"
          :class="disabledPages.includes(page.path)
            ? 'bg-red-50 text-red-600 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'"
        >
          {{ page.label }}
          <span class="text-xs ml-1 opacity-60">{{ disabledPages.includes(page.path) ? 'OFF' : 'ON' }}</span>
        </button>
      </div>
    </div>

    <!-- ═══ USERS ═══ -->
    <div class="flex items-center gap-3 mb-4">
      <div class="h-px flex-1 bg-primary-100"></div>
      <span class="text-xs font-medium text-primary-400 uppercase tracking-widest">Users</span>
      <div class="h-px flex-1 bg-primary-100"></div>
    </div>

    <!-- User Management -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <div class="flex items-center gap-3 mb-6">
        <h2 class="font-serif text-xl font-bold text-primary-900">User Management</h2>
        <span v-if="pendingCount > 0" class="bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {{ pendingCount }} pending
        </span>
      </div>

      <div v-if="!users.length" class="text-sm text-primary-400">No users found.</div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-primary-100 text-left">
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Username</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Display Name</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Email</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Role</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Status</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Created</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-b border-primary-50 last:border-0">
              <td class="px-3 py-2.5 text-primary-700 font-medium">{{ user.username }}</td>
              <td class="px-3 py-2.5 text-primary-600">{{ user.displayName }}</td>
              <td class="px-3 py-2.5 text-primary-600">{{ user.email || '—' }}</td>
              <td class="px-3 py-2.5">
                <span :class="user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-primary-100 text-primary-600'" class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ user.role }}
                </span>
              </td>
              <td class="px-3 py-2.5">
                <span :class="statusClass(user.status)" class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ user.status }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-primary-500 text-xs">{{ formatTime(user.createdAt) }}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <button
                    v-if="user.status === 'pending'"
                    @click="approveUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    v-if="user.status === 'pending'"
                    @click="rejectUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    v-if="user.status === 'approved' && user.role !== 'admin'"
                    @click="suspendUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    Suspend
                  </button>
                  <button
                    v-if="user.status === 'suspended'"
                    @click="suspendUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                  >
                    Unsuspend
                  </button>
                  <button
                    v-if="user.role !== 'admin'"
                    @click="removeUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-500 hover:bg-primary-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══ DATA ═══ -->
    <div class="flex items-center gap-3 mb-4">
      <div class="h-px flex-1 bg-primary-100"></div>
      <span class="text-xs font-medium text-primary-400 uppercase tracking-widest">Data</span>
      <div class="h-px flex-1 bg-primary-100"></div>
    </div>

    <!-- Data Refresh -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="font-serif text-xl font-bold text-primary-900">Data Refresh</h2>
        <button
          @click="handleRefreshAll"
          :disabled="anyRefreshing"
          class="bg-primary-900 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
        >
          {{ anyRefreshing ? 'Refreshing...' : 'Refresh All' }}
        </button>
      </div>

      <!-- Per-source cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Country Statistics -->
        <div class="border border-primary-100 rounded-xl p-4">
          <div class="text-sm font-semibold text-primary-800 mb-1">Country Statistics</div>
          <div class="text-xs text-primary-400 mb-3">World Bank + REST Countries + UNDP</div>
          <div v-if="refreshStatus?.country?.refreshing" class="text-xs text-blue-600 mb-2">
            {{ refreshStatus.country.progress || 'Refreshing...' }}
          </div>
          <div v-else-if="refreshStatus?.country?.last_refresh" class="text-xs text-primary-500 mb-2">
            Last: {{ formatTime(refreshStatus.country.last_refresh) }}
          </div>
          <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
          <div v-if="refreshStatus?.country?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.country.last_error">
            {{ refreshStatus.country.last_error }}
          </div>
          <button
            @click="handleRefreshSource('country')"
            :disabled="refreshStatus?.country?.refreshing"
            class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
          >
            {{ refreshStatus?.country?.refreshing ? 'Running...' : 'Refresh' }}
          </button>
        </div>

        <!-- UN Voting Data -->
        <div class="border border-primary-100 rounded-xl p-4">
          <div class="text-sm font-semibold text-primary-800 mb-1">UN Voting Data</div>
          <div class="text-xs text-primary-400 mb-3">UN Digital Library CSV</div>
          <div v-if="refreshStatus?.unvotes?.refreshing" class="text-xs text-blue-600 mb-2">
            {{ refreshStatus.unvotes.progress || 'Refreshing...' }}
          </div>
          <div v-else-if="refreshStatus?.unvotes?.last_refresh" class="text-xs text-primary-500 mb-2">
            Last: {{ formatTime(refreshStatus.unvotes.last_refresh) }}
          </div>
          <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
          <div v-if="refreshStatus?.unvotes?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.unvotes.last_error">
            {{ refreshStatus.unvotes.last_error }}
          </div>
          <button
            @click="handleRefreshSource('unvotes')"
            :disabled="refreshStatus?.unvotes?.refreshing"
            class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
          >
            {{ refreshStatus?.unvotes?.refreshing ? 'Running...' : 'Refresh' }}
          </button>

          <!-- Upload a voting CSV downloaded by hand from the UN Digital Library -->
          <div class="mt-4 pt-3 border-t border-primary-100">
            <div class="text-xs font-medium text-primary-700 mb-1">Upload a newer voting file</div>
            <p class="text-[11px] text-primary-400 mb-2 leading-snug">
              The UN Digital Library asks for a human check, so download the latest <code>…_ga_voting.csv</code> from
              <a href="https://digitallibrary.un.org/record/4060887" target="_blank" rel="noopener" class="underline">record 4060887</a> in your browser, then upload it here (.csv or .csv.gz).
            </p>
            <input ref="votesFile" type="file" accept=".csv,.gz,text/csv" class="block w-full text-xs text-primary-600 file:mr-2 file:px-2.5 file:py-1 file:rounded-md file:border-0 file:bg-primary-100 file:text-primary-700" @change="votesPicked" />
            <p v-if="votesFileName" class="mt-1 text-[11px] text-primary-600 break-all">{{ votesFileName }}</p>
            <label class="flex items-center gap-1.5 mt-2 text-[11px] text-primary-500">
              <input v-model="votesImport" type="checkbox" class="rounded"> Import it right after uploading
            </label>
            <button
              class="mt-2 text-xs px-3 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-40"
              :disabled="!votesFileName || votesUploading" @click="uploadVotes"
            >{{ votesUploading ? (votesProgress < 100 ? `Uploading ${votesProgress}%` : 'Importing…') : 'Upload' }}</button>
            <div v-if="votesUploading" class="mt-2 h-1.5 rounded-full bg-primary-100 overflow-hidden">
              <div class="h-full bg-accent-600 transition-all" :style="{ width: votesProgress + '%' }" />
            </div>
            <p v-if="votesMsg" class="mt-2 text-[11px] leading-snug" :class="votesOk ? 'text-emerald-700' : 'text-red-600'">{{ votesMsg }}</p>
          </div>
        </div>

        <!-- Theme Classification -->
        <div class="border border-primary-100 rounded-xl p-4">
          <div class="text-sm font-semibold text-primary-800 mb-1">Theme Classification</div>
          <div class="text-xs text-primary-400 mb-3">Regex-based resolution classifier</div>
          <div v-if="refreshStatus?.themes?.refreshing" class="text-xs text-blue-600 mb-2">
            {{ refreshStatus.themes.progress || 'Refreshing...' }}
          </div>
          <div v-else-if="refreshStatus?.themes?.last_refresh" class="text-xs text-primary-500 mb-2">
            Last: {{ formatTime(refreshStatus.themes.last_refresh) }}
          </div>
          <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
          <div v-if="refreshStatus?.themes?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.themes.last_error">
            {{ refreshStatus.themes.last_error }}
          </div>
          <button
            @click="handleRefreshSource('themes')"
            :disabled="refreshStatus?.themes?.refreshing"
            class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
          >
            {{ refreshStatus?.themes?.refreshing ? 'Running...' : 'Refresh' }}
          </button>
        </div>

        <!-- GDELT Events & Tone -->
        <div class="border border-primary-100 rounded-xl p-4">
          <div class="text-sm font-semibold text-primary-800 mb-1">GDELT Events &amp; Tone</div>
          <div class="text-xs text-primary-400 mb-3">GDELT Event Database + DOC API</div>
          <div v-if="refreshStatus?.gdelt?.refreshing" class="text-xs text-blue-600 mb-2">
            {{ refreshStatus.gdelt.progress || 'Refreshing...' }}
          </div>
          <div v-else-if="refreshStatus?.gdelt?.last_refresh" class="text-xs text-primary-500 mb-2">
            Last: {{ formatTime(refreshStatus.gdelt.last_refresh) }}
          </div>
          <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
          <div v-if="refreshStatus?.gdelt?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.gdelt.last_error">
            {{ refreshStatus.gdelt.last_error }}
          </div>
          <button
            @click="handleRefreshSource('gdelt')"
            :disabled="refreshStatus?.gdelt?.refreshing"
            class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
          >
            {{ refreshStatus?.gdelt?.refreshing ? 'Running...' : 'Refresh' }}
          </button>
        </div>

        <!-- UN Speeches -->
        <div class="border border-primary-100 rounded-xl p-4">
          <div class="text-sm font-semibold text-primary-800 mb-1">UN Speeches</div>
          <div class="text-xs text-primary-400 mb-3">gadebate.un.org</div>
          <div v-if="refreshStatus?.speeches?.refreshing" class="text-xs text-blue-600 mb-2">
            {{ refreshStatus.speeches.progress || 'Refreshing...' }}
          </div>
          <div v-else-if="refreshStatus?.speeches?.last_refresh" class="text-xs text-primary-500 mb-2">
            Last: {{ formatTime(refreshStatus.speeches.last_refresh) }}
          </div>
          <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
          <div v-if="refreshStatus?.speeches?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.speeches.last_error">
            {{ refreshStatus.speeches.last_error }}
          </div>
          <button
            @click="handleRefreshSource('speeches')"
            :disabled="refreshStatus?.speeches?.refreshing"
            class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
          >
            {{ refreshStatus?.speeches?.refreshing ? 'Running...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Result message -->
      <div v-if="refreshResult" class="mt-4 rounded-lg px-4 py-3 text-sm" :class="refreshResult.ok !== false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
        {{ refreshResult.message }}
      </div>
    </div>

    <!-- Data Source Timestamps -->
    <div v-if="sourceMeta" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Data Sources</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="(ts, source) in sourceMeta" :key="source" class="border border-primary-100 rounded-lg p-4">
          <div class="text-xs text-primary-400 uppercase tracking-wider mb-1">{{ source }}</div>
          <div class="text-sm text-primary-700">{{ ts ? formatTime(ts) : 'Not fetched' }}</div>
        </div>
      </div>
    </div>

    <!-- Data Coverage -->
    <div v-if="coverage" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Data Coverage</h2>
      <p class="text-sm text-primary-500 mb-4">{{ coverage.total }} countries loaded</p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-primary-100 text-left">
              <th class="px-4 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Indicator</th>
              <th class="px-4 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Countries</th>
              <th class="px-4 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Coverage</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ind in coverage.indicators" :key="ind.name" class="border-b border-primary-50 last:border-0">
              <td class="px-4 py-2.5 text-primary-700">{{ ind.name }}</td>
              <td class="px-4 py-2.5 text-right text-primary-600 tabular-nums">{{ ind.count }}</td>
              <td class="px-4 py-2.5 text-right">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-20 h-1.5 bg-primary-100 rounded-full overflow-hidden">
                    <div class="h-full bg-primary-400 rounded-full" :style="{ width: ind.pct + '%' }"></div>
                  </div>
                  <span class="text-primary-500 text-xs tabular-nums w-12 text-right">{{ ind.pct }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Admin — World Country Groups' })

const { state: authState, logout } = useAuth()
const sourceMeta = ref<Record<string, string | null> | null>(null)
const coverage = ref<{ total: number; indicators: { name: string; count: number; pct: number }[] } | null>(null)
const refreshStatus = ref<any>(null)
const refreshResult = ref<{ ok: boolean; message: string } | null>(null)
const users = ref<any[]>([])
const siteMode = ref<'public' | 'restricted'>('restricted')
const disabledPages = ref<string[]>([])
const groupCount = ref(0)
const aiConfig = ref<any>(null)
const showAIForm = ref(false)
const aiForm = reactive({ id: '', name: '', type: 'openai' as string, model: '', apiKey: '', baseUrl: '' })
const cacheStats = ref<any>(null)
const cacheMaxAge = ref(168)
const cronJobs = ref<any[]>([])
const cronMessage = ref<{ ok: boolean; text: string } | null>(null)
const showCronForm = ref(false)
const editingCronId = ref<string | null>(null)
const runningCronJob = ref<string | null>(null)
const cronForm = reactive({ id: '', label: '', script: '', schedule: '0 */6 * * *', logFile: '' })
const newsSources = ref<any[]>([])
const newsMessage = ref<{ ok: boolean; text: string } | null>(null)
const showNewsForm = ref(false)
const testingNewsUrl = ref(false)
const newsTestResult = ref<any>(null)
const newsForm = reactive({ id: '', name: '', url: '', type: 'rss' as string, category: 'wire' as string })
const newsFeedStats = reactive({ articles: 0, sources: 0, countries: 0, sizeKB: 0, lastUpdated: '', enabledSources: 0, totalSources: 0 })
const stmtFeedStats = reactive({ statements: 0, sources: 0, countries: 0, sizeKB: 0, lastUpdated: '', enabledSources: 0, totalSources: 0 })
const pulseStyle = reactive({ tone: 'analytical' as string, temperature: 0.7 })
const pulseStyleMsg = ref('')
const pulseToneOptions = [
  { value: 'formal-diplomatic', label: 'Diplomatic Cable' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'journalistic', label: 'Journalistic' },
]
const showPromptEditor = ref(false)
const promptDefaults = ref<Record<string, string>>({})
const showingDefaults = ref<string[]>([])
const expandedPromptGroups = ref<string[]>([])
const promptForm = reactive({
  systemBase: '',
  countryInstructions: '',
  bilateralInstructions: '',
  groupInstructions: '',
  newsBriefingInstructions: '',
  speechSummaryInstructions: '',
  anomalyDetectionInstructions: '',
  compareAnalysisInstructions: '',
  groupSuggestionsInstructions: '',
  riskScoreInstructions: '',
  meetingDocInstructions: '',
  cableInstructions: '',
  chatInstructions: '',
  smartSearchInstructions: '',
  pulseInstructions: '',
})

const promptGroups = [
  {
    label: 'Core',
    fields: [
      { key: 'systemBase', label: 'System Base Prompt' },
    ],
  },
  {
    label: 'Intelligence Briefings',
    fields: [
      { key: 'countryInstructions', label: 'Country Briefing' },
      { key: 'bilateralInstructions', label: 'Bilateral Prep' },
      { key: 'groupInstructions', label: 'Group Trends' },
      { key: 'newsBriefingInstructions', label: 'News Briefing' },
    ],
  },
  {
    label: 'Analysis Tools',
    fields: [
      { key: 'speechSummaryInstructions', label: 'Speech Summary' },
      { key: 'anomalyDetectionInstructions', label: 'Anomaly Detection' },
      { key: 'compareAnalysisInstructions', label: 'Compare Analysis' },
      { key: 'riskScoreInstructions', label: 'Risk Score' },
    ],
  },
  {
    label: 'Documents',
    fields: [
      { key: 'meetingDocInstructions', label: 'Meeting Document' },
      { key: 'cableInstructions', label: 'Diplomatic Cable' },
      { key: 'pulseInstructions', label: 'Diplomatic Pulse' },
    ],
  },
  {
    label: 'Interactive',
    fields: [
      { key: 'chatInstructions', label: 'Chat' },
      { key: 'smartSearchInstructions', label: 'Smart Search' },
      { key: 'groupSuggestionsInstructions', label: 'Group Suggestions' },
    ],
  },
]

function togglePromptGroup(label: string) {
  const idx = expandedPromptGroups.value.indexOf(label)
  if (idx >= 0) expandedPromptGroups.value.splice(idx, 1)
  else expandedPromptGroups.value.push(label)
}

function toggleDefaultView(key: string) {
  const idx = showingDefaults.value.indexOf(key)
  if (idx >= 0) showingDefaults.value.splice(idx, 1)
  else showingDefaults.value.push(key)
}

const toggleablePages = [
  { path: '/groups', label: 'Groups' },
  { path: '/countries', label: 'Countries' },
  { path: '/compare', label: 'Compare' },
  { path: '/votes', label: 'Votes' },
  { path: '/conflicts', label: 'Conflicts' },
  { path: '/speeches', label: 'Speeches' },
  { path: '/sources', label: 'Sources' },
  { path: '/about', label: 'About' },
]

let pollInterval: ReturnType<typeof setInterval> | null = null

const pendingCount = computed(() => users.value.filter((u) => u.status === 'pending').length)

const anyRefreshing = computed(() => {
  const s = refreshStatus.value
  if (!s) return false
  return s.country?.refreshing || s.unvotes?.refreshing || s.themes?.refreshing || s.gdelt?.refreshing || s.speeches?.refreshing
})

function statusClass(status: string) {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-700'
    case 'pending': return 'bg-amber-100 text-amber-700'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'suspended': return 'bg-orange-100 text-orange-700'
    default: return 'bg-primary-100 text-primary-600'
  }
}

async function loadUsers() {
  try {
    users.value = await $fetch<any[]>('/api/admin/users')
  } catch {
    // Not critical
  }
}

async function approveUser(id: string) {
  try {
    await $fetch(`/api/admin/users/${id}/approve`, { method: 'POST' })
    await loadUsers()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to approve user')
  }
}

async function rejectUser(id: string) {
  try {
    await $fetch(`/api/admin/users/${id}/reject`, { method: 'POST' })
    await loadUsers()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to reject user')
  }
}

async function suspendUser(id: string) {
  try {
    await $fetch(`/api/admin/users/${id}/suspend`, { method: 'POST' })
    await loadUsers()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to suspend/unsuspend user')
  }
}

async function removeUser(id: string) {
  if (!confirm('Are you sure you want to delete this user?')) return
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    await loadUsers()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to delete user')
  }
}

async function togglePage(path: string) {
  const current = [...disabledPages.value]
  const idx = current.indexOf(path)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(path)
  }
  try {
    await $fetch('/api/admin/disabled-pages', { method: 'POST', body: { pages: current } })
    disabledPages.value = current
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to update pages')
  }
}

async function toggleSiteMode(mode: 'public' | 'restricted') {
  try {
    await $fetch('/api/admin/site-mode', { method: 'POST', body: { mode } })
    siteMode.value = mode
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to change site mode')
  }
}

async function loadMeta() {
  try {
    const meta = await $fetch<any>('/api/meta')
    if (meta) {
      sourceMeta.value = meta.sources || null
      if (meta.country_count) {
        coverage.value = {
          total: meta.country_count,
          indicators: meta.coverage || [],
        }
      }
    }
  } catch {
    // Not critical
  }
}

async function loadRefreshStatus() {
  try {
    refreshStatus.value = await $fetch<any>('/api/admin/refresh-status')
  } catch {
    // Not critical
  }
}

function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(async () => {
    await loadRefreshStatus()
    if (!anyRefreshing.value) {
      stopPolling()
      await loadMeta()
    }
  }, 2000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// ---------- UN voting CSV upload ----------
const votesFile = ref<HTMLInputElement | null>(null)
const votesFileName = ref('')
const votesImport = ref(true)
const votesUploading = ref(false)
const votesProgress = ref(0)
const votesMsg = ref('')
const votesOk = ref(false)
function votesPicked() { votesFileName.value = votesFile.value?.files?.[0]?.name || ''; votesMsg.value = '' }
function uploadVotes() {
  const file = votesFile.value?.files?.[0]
  if (!file) return
  votesUploading.value = true; votesProgress.value = 0; votesMsg.value = ''
  // XHR (not fetch) so we can show upload progress; the raw file is the request body
  const xhr = new XMLHttpRequest()
  xhr.open('POST', `/api/admin/upload-votes?filename=${encodeURIComponent(file.name)}&import=${votesImport.value ? 1 : 0}`)
  xhr.setRequestHeader('Content-Type', file.name.endsWith('.gz') ? 'application/gzip' : 'text/csv')
  xhr.upload.onprogress = (e) => { if (e.lengthComputable) votesProgress.value = Math.round((e.loaded / e.total) * 100) }
  xhr.onload = async () => {
    votesUploading.value = false
    let body: any = {}
    try { body = JSON.parse(xhr.responseText) } catch {}
    if (xhr.status >= 200 && xhr.status < 300) {
      votesOk.value = body.imported ? body.imported.ok !== false : true
      const mb = (body.size / 1024 / 1024).toFixed(0)
      votesMsg.value = body.imported
        ? (body.imported.ok !== false
            ? `Saved ${body.file} (${mb} MB) and imported ${body.imported.resolutions_processed?.toLocaleString?.() ?? ''} resolutions.`
            : `Saved ${body.file}, but the import failed: ${(body.imported.errors || []).join(', ')}`)
        : `Saved ${body.file} (${mb} MB). Press Refresh to import it.`
      await loadRefreshStatus(); await loadMeta()
    } else {
      votesOk.value = false
      votesMsg.value = body.statusMessage || body.message || `Upload failed (HTTP ${xhr.status})`
    }
  }
  xhr.onerror = () => { votesUploading.value = false; votesOk.value = false; votesMsg.value = 'Upload failed: connection error' }
  xhr.send(file)
}

async function handleRefreshSource(target: string) {
  refreshResult.value = null
  startPolling()
  try {
    const result = await $fetch<any>('/api/admin/refresh', { method: 'POST', query: { target } })
    const ok = result.ok !== false
    refreshResult.value = {
      ok,
      message: ok
        ? `${target} refresh completed at ${formatTime(result.updated_at)}`
        : `${target} refresh failed: ${result.errors?.join(', ') || 'Unknown error'}`,
    }
    await loadRefreshStatus()
    await loadMeta()
  } catch (e: any) {
    refreshResult.value = { ok: false, message: e?.data?.statusMessage || 'Request failed' }
  }
  stopPolling()
}

async function handleRefreshAll() {
  refreshResult.value = null
  startPolling()
  try {
    await $fetch<any>('/api/admin/refresh', { method: 'POST', query: { target: 'all' } })
    refreshResult.value = { ok: true, message: 'All data sources refreshed successfully.' }
    await loadRefreshStatus()
    await loadMeta()
  } catch (e: any) {
    refreshResult.value = { ok: false, message: e?.data?.statusMessage || 'Request failed' }
  }
  stopPolling()
}

async function loadAIConfig() {
  try {
    aiConfig.value = await $fetch<any>('/api/admin/ai-config')
    if (aiConfig.value?.prompts) {
      const p = aiConfig.value.prompts
      for (const key of Object.keys(promptForm) as (keyof typeof promptForm)[]) {
        (promptForm as any)[key] = p[key] || ''
      }
    }
    if (aiConfig.value?.pulseStyle) {
      pulseStyle.tone = aiConfig.value.pulseStyle.tone || 'analytical'
      pulseStyle.temperature = aiConfig.value.pulseStyle.temperature ?? 0.7
    }
  } catch {}
  try {
    promptDefaults.value = await $fetch<Record<string, string>>('/api/admin/ai-config/prompt-defaults')
  } catch {}
}

async function addAIProvider() {
  try {
    await $fetch('/api/admin/ai-config', {
      method: 'POST',
      body: { action: 'add', provider: { ...aiForm, enabled: true } },
    })
    showAIForm.value = false
    Object.assign(aiForm, { id: '', name: '', type: 'openai', model: '', apiKey: '', baseUrl: '' })
    await loadAIConfig()
  } catch (e: any) {
    alert(e?.data?.statusMessage || e?.message || 'Failed to add provider')
  }
}

// ---------- AI provider editing ----------
const aiEditing = ref<string | null>(null)
const aiEdit = reactive<any>({ name: '', model: '', temperature: '', maxTokens: '', apiKey: '', baseUrl: '' })
const aiEditOrigModel = ref('')
const aiDupFor = ref<string | null>(null)
const aiDup = reactive({ model: '', name: '', activate: true })
const aiModels = reactive<Record<string, { loading: boolean; list: any[]; error?: string }>>({})
const aiTest = reactive<Record<string, any>>({})
const aiMsg = ref('')

function startEditAI(p: any) {
  aiDupFor.value = null; aiMsg.value = ''
  if (aiEditing.value === p.id) { aiEditing.value = null; return }
  aiEditing.value = p.id
  Object.assign(aiEdit, { name: p.name, model: p.model, temperature: p.temperature ?? '', maxTokens: p.maxTokens ?? '', apiKey: '', baseUrl: p.baseUrl || '' })
  aiEditOrigModel.value = p.model
}
function startDupAI(p: any) {
  aiEditing.value = null; aiMsg.value = ''
  aiDupFor.value = aiDupFor.value === p.id ? null : p.id
  Object.assign(aiDup, { model: '', name: '', activate: true })
  if (aiDupFor.value && !aiModels[p.id]?.list?.length) loadModels(p.id)
}
async function loadModels(id: string) {
  aiModels[id] = { loading: true, list: aiModels[id]?.list || [] }
  try {
    const r = await $fetch<any>('/api/admin/ai-config/models', { query: { id } })
    aiModels[id] = { loading: false, list: r.models || [], error: r.error }
  } catch (e: any) {
    aiModels[id] = { loading: false, list: [], error: e?.data?.message || e?.message || 'failed' }
  }
}
async function saveEditAI(id: string, thenTest = false) {
  aiMsg.value = ''
  try {
    // keep the display name in step with the model ("OpenAI GPT-5" -> "OpenAI GPT-5.5")
    const orig = aiEditOrigModel.value
    if (orig && aiEdit.model !== orig) {
      const re = new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      if (re.test(aiEdit.name)) aiEdit.name = aiEdit.name.replace(re, aiEdit.model.toUpperCase().startsWith('GPT') ? aiEdit.model.replace(/^gpt/i, 'GPT') : aiEdit.model)
    }
    await $fetch('/api/admin/ai-config', { method: 'POST', body: { action: 'update', id, updates: { ...aiEdit } } })
    aiMsg.value = 'Saved'
    await loadAIConfig()
    if (thenTest) await testAI(id)
  } catch (e: any) {
    aiMsg.value = 'Error: ' + (e?.data?.message || e?.data?.statusMessage || 'could not save')
  }
}
async function saveDupAI(sourceId: string) {
  aiMsg.value = ''
  try {
    const r = await $fetch<any>('/api/admin/ai-config', { method: 'POST', body: { action: 'duplicate', sourceId, model: aiDup.model, name: aiDup.name, activate: aiDup.activate } })
    aiDupFor.value = null
    await loadAIConfig()
    await testAI(r.id)
  } catch (e: any) {
    aiMsg.value = 'Error: ' + (e?.data?.message || e?.data?.statusMessage || 'could not add model')
  }
}
async function testAI(id: string) {
  aiTest[id] = { running: true }
  try {
    aiTest[id] = await $fetch<any>('/api/admin/ai-config', { method: 'POST', body: { action: 'test', id } })
  } catch (e: any) {
    aiTest[id] = { ok: false, error: e?.data?.message || 'request failed' }
  }
}

async function setActiveAI(id: string) {
  try {
    await $fetch('/api/admin/ai-config', { method: 'POST', body: { action: 'set-active', id } })
    await loadAIConfig()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to set active provider')
  }
}

async function removeAIProvider(id: string) {
  if (!confirm('Remove this AI provider?')) return
  try {
    await $fetch(`/api/admin/ai-config/${id}`, { method: 'DELETE' })
    await loadAIConfig()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to remove provider')
  }
}

async function savePrompts() {
  try {
    const prompts: any = {}
    for (const [key, value] of Object.entries(promptForm)) {
      if (typeof value === 'string' && value.trim()) prompts[key] = value.trim()
    }
    await $fetch('/api/admin/ai-config', { method: 'POST', body: { action: 'save-prompts', prompts } })
    await loadAIConfig()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to save prompts')
  }
}

function resetPrompts() {
  for (const key of Object.keys(promptForm) as (keyof typeof promptForm)[]) {
    (promptForm as any)[key] = ''
  }
  savePrompts()
}

async function loadCacheStats() {
  try {
    cacheStats.value = await $fetch<any>('/api/admin/ai-cache')
    cacheMaxAge.value = cacheStats.value?.maxAgeHours || 168
  } catch {}
}

async function saveCacheMaxAge() {
  try {
    await $fetch('/api/admin/ai-cache', { method: 'POST', body: { action: 'set-max-age', hours: cacheMaxAge.value } })
    await loadCacheStats()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to update max age')
  }
}

async function clearCacheEntry(key: string) {
  try {
    await $fetch('/api/admin/ai-cache', { method: 'POST', body: { action: 'clear-entry', key } })
    await loadCacheStats()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to clear entry')
  }
}

async function clearAllCache() {
  if (!confirm('Clear all cached analyses?')) return
  try {
    await $fetch('/api/admin/ai-cache', { method: 'POST', body: { action: 'clear-all' } })
    await loadCacheStats()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to clear cache')
  }
}

async function loadCronJobs() {
  try {
    const res = await $fetch<any>('/api/admin/cron-jobs')
    cronJobs.value = res.jobs || []
  } catch {}
}

async function toggleCronJob(id: string, enabled: boolean) {
  cronMessage.value = null
  try {
    const res = await $fetch<any>('/api/admin/cron-jobs', { method: 'POST', body: { action: 'toggle', id, enabled } })
    cronJobs.value = res.jobs || []
    cronMessage.value = { ok: true, text: `Job ${enabled ? 'enabled' : 'disabled'} and crontab synced.` }
  } catch (e: any) {
    cronMessage.value = { ok: false, text: e?.data?.statusMessage || 'Failed to toggle job' }
  }
}

async function runCronJob(id: string) {
  cronMessage.value = null
  runningCronJob.value = id
  try {
    const res = await $fetch<any>('/api/admin/cron-jobs', { method: 'POST', body: { action: 'run-now', id } })
    cronJobs.value = res.jobs || []
    if (res.ok) {
      cronMessage.value = { ok: true, text: `Job "${id}" completed successfully.${res.output ? ' Output: ' + res.output.slice(0, 200) : ''}` }
    } else {
      cronMessage.value = { ok: false, text: `Job "${id}" failed: ${res.error}` }
    }
  } catch (e: any) {
    cronMessage.value = { ok: false, text: e?.data?.statusMessage || 'Failed to run job' }
  } finally {
    runningCronJob.value = null
  }
}

function editCronJob(job: any) {
  editingCronId.value = job.id
  Object.assign(cronForm, { id: job.id, label: job.label, script: job.script, schedule: job.schedule, logFile: job.logFile })
  showCronForm.value = true
}

async function saveCronJob() {
  cronMessage.value = null
  try {
    if (editingCronId.value) {
      const res = await $fetch<any>('/api/admin/cron-jobs', {
        method: 'POST',
        body: { action: 'update', id: editingCronId.value, label: cronForm.label, schedule: cronForm.schedule, logFile: cronForm.logFile },
      })
      cronJobs.value = res.jobs || []
      cronMessage.value = { ok: true, text: `Job "${editingCronId.value}" updated.` }
    } else {
      const res = await $fetch<any>('/api/admin/cron-jobs', {
        method: 'POST',
        body: { action: 'add', job: { ...cronForm } },
      })
      cronJobs.value = res.jobs || []
      cronMessage.value = { ok: true, text: `Job "${cronForm.id}" added.` }
    }
    showCronForm.value = false
    editingCronId.value = null
  } catch (e: any) {
    cronMessage.value = { ok: false, text: e?.data?.statusMessage || 'Failed to save job' }
  }
}

async function deleteCronJob(id: string) {
  if (!confirm(`Remove job "${id}"? This will also remove it from the system crontab.`)) return
  cronMessage.value = null
  try {
    const res = await $fetch<any>('/api/admin/cron-jobs', { method: 'POST', body: { action: 'remove', id } })
    cronJobs.value = res.jobs || []
    cronMessage.value = { ok: true, text: `Job "${id}" removed.` }
  } catch (e: any) {
    cronMessage.value = { ok: false, text: e?.data?.statusMessage || 'Failed to remove job' }
  }
}

async function loadNewsSources() {
  try {
    const res = await $fetch<any>('/api/admin/news-sources')
    newsSources.value = res.sources || []
    // Update stats
    const sources = res.sources || []
    newsFeedStats.totalSources = sources.length
    newsFeedStats.enabledSources = sources.filter((s: any) => s.enabled).length
    const lastFetches = sources.map((s: any) => s.lastFetch).filter(Boolean).sort().reverse()
    newsFeedStats.lastUpdated = lastFetches[0] || ''
  } catch {}
}

async function loadNewsFeedStats() {
  try {
    const res = await $fetch<any>('/api/news/stats')
    newsFeedStats.articles = res.articleCount || 0
    newsFeedStats.sources = res.sourceCount || 0
    newsFeedStats.countries = res.countryCoverage || 0
    newsFeedStats.sizeKB = res.sizeKB || 0
  } catch {}
}

async function savePulseStyle() {
  pulseStyleMsg.value = ''
  try {
    await $fetch('/api/admin/ai-config', {
      method: 'POST',
      body: {
        action: 'save-pulse-style',
        style: { tone: pulseStyle.tone, temperature: pulseStyle.temperature },
      },
    })
    pulseStyleMsg.value = 'Saved'
  } catch (e: any) {
    pulseStyleMsg.value = 'Error: ' + (e.data?.message || e.message || 'Failed')
  }
}

function newsCategoryClass(cat: string) {
  switch (cat) {
    case 'government': return 'bg-blue-100 text-blue-700'
    case 'wire': return 'bg-purple-100 text-purple-700'
    case 'institutional': return 'bg-teal-100 text-teal-700'
    case 'regional': return 'bg-orange-100 text-orange-700'
    case 'lldc-sids': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-primary-100 text-primary-600'
  }
}

async function addNewSource() {
  newsMessage.value = null
  try {
    const res = await $fetch<any>('/api/admin/news-sources', {
      method: 'POST',
      body: { action: 'add', source: { ...newsForm } },
    })
    newsSources.value = res.sources || []
    newsMessage.value = { ok: true, text: `Source "${newsForm.name}" added.` }
    showNewsForm.value = false
  } catch (e: any) {
    newsMessage.value = { ok: false, text: e?.data?.statusMessage || 'Failed to add source' }
  }
}

async function toggleNewsSource(id: string, enabled: boolean) {
  newsMessage.value = null
  try {
    const res = await $fetch<any>('/api/admin/news-sources', {
      method: 'POST',
      body: { action: 'toggle', id, enabled },
    })
    newsSources.value = res.sources || []
    newsMessage.value = { ok: true, text: `Source ${enabled ? 'enabled' : 'disabled'}.` }
  } catch (e: any) {
    newsMessage.value = { ok: false, text: e?.data?.statusMessage || 'Failed to toggle source' }
  }
}

async function deleteNewsSource(id: string) {
  if (!confirm(`Remove news source "${id}"?`)) return
  newsMessage.value = null
  try {
    const res = await $fetch<any>('/api/admin/news-sources', {
      method: 'POST',
      body: { action: 'remove', id },
    })
    newsSources.value = res.sources || []
    newsMessage.value = { ok: true, text: `Source "${id}" removed.` }
  } catch (e: any) {
    newsMessage.value = { ok: false, text: e?.data?.statusMessage || 'Failed to remove source' }
  }
}

async function testNewsUrl() {
  newsTestResult.value = null
  testingNewsUrl.value = true
  try {
    newsTestResult.value = await $fetch<any>('/api/admin/news-sources', {
      method: 'POST',
      body: { action: 'test', url: newsForm.url },
    })
  } catch (e: any) {
    newsTestResult.value = { ok: false, error: e?.data?.statusMessage || 'Test failed' }
  }
  testingNewsUrl.value = false
}

async function loadStmtFeedStats() {
  try {
    const res = await $fetch<any>('/api/statements/stats')
    stmtFeedStats.statements = res.statementCount || 0
    stmtFeedStats.sources = res.sourceCount || 0
    stmtFeedStats.countries = res.countryCoverage || 0
    stmtFeedStats.sizeKB = res.sizeKB || 0
  } catch {}
  try {
    const res = await $fetch<any>('/api/admin/statement-sources')
    const sources = res.sources || []
    stmtFeedStats.totalSources = sources.length
    stmtFeedStats.enabledSources = sources.filter((s: any) => s.enabled).length
  } catch {}
}

async function handleLogout() {
  await logout()
  await navigateTo('/login')
}

function formatTime(iso: string): string {
  if (!iso) return 'N/A'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

onMounted(async () => {
  siteMode.value = authState.value.siteMode || 'restricted'
  disabledPages.value = authState.value.disabledPages || []
  await Promise.all([
    loadUsers(),
    loadMeta(),
    loadRefreshStatus(),
    loadAIConfig(),
    loadCacheStats(),
    loadCronJobs(),
    loadNewsSources(),
    loadNewsFeedStats(),
    loadStmtFeedStats(),
    $fetch<any[]>('/api/admin/groups').then(g => { groupCount.value = g.length }).catch(() => {}),
  ])
})

onUnmounted(() => {
  stopPolling()
})
</script>
