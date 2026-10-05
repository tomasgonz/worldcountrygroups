<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div class="flex items-center justify-between mb-6">
      <h1 class="font-serif text-3xl font-bold text-primary-900">Admin</h1>
      <button
        @click="handleLogout"
        class="text-sm text-primary-400 hover:text-primary-900 transition-colors"
      >
        Logout
      </button>
    </div>

    <!-- Tabs -->
    <nav class="admin-tabs sticky top-[72px] z-20 -mx-4 sm:mx-0 px-4 sm:px-0 mb-8 bg-primary-50/90 backdrop-blur border-b border-primary-100" aria-label="Admin sections">
      <div class="flex gap-1 overflow-x-auto" role="tablist">
        <button v-for="t in ADMIN_TABS" :key="t.id" role="tab" :aria-selected="tab === t.id" class="relative shrink-0 px-3.5 py-2.5 text-sm border-b-2 -mb-px transition-colors"
          :class="tab === t.id ? 'border-primary-900 text-primary-900 font-medium' : 'border-transparent text-primary-500 hover:text-primary-800'" @click="setTab(t.id)">
          {{ t.label }}
          <span v-if="tabAlerts[t.id]" class="ml-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">{{ tabAlerts[t.id] }}</span>
        </button>
      </div>
    </nav>

    <!-- ═══ OVERVIEW ═══ -->
    <div v-show="tab === 'overview'">
      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h2 class="font-serif text-xl font-bold text-primary-900">Needs attention</h2>
          <button class="text-xs text-accent-600 hover:underline" @click="refreshOverview">Check again</button>
        </div>
        <ul v-if="attention.length" class="divide-y divide-primary-100">
          <li v-for="a in attention" :key="a.key" class="py-3 flex flex-wrap items-start gap-3">
            <span class="mt-0.5 shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" :class="a.level === 'problem' ? 'bg-red-100 text-red-700' : a.level === 'setup' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'">
              <span aria-hidden="true">{{ a.level === 'problem' ? '!' : a.level === 'setup' ? '◔' : 'i' }}</span>{{ a.level === 'problem' ? 'Problem' : a.level === 'setup' ? 'Set up' : 'Note' }}
            </span>
            <div class="flex-1 min-w-[14rem]">
              <div class="text-sm text-primary-900">{{ a.title }}</div>
              <div v-if="a.detail" class="text-xs text-primary-500 mt-0.5">{{ a.detail }}</div>
            </div>
            <button class="shrink-0 text-xs px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50" @click="goTo(a.tab, a.anchor)">{{ a.action }}</button>
          </li>
        </ul>
        <p v-else class="text-sm text-emerald-700">Everything looks fine.</p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-primary-100 rounded-2xl overflow-hidden ring-1 ring-primary-100 mb-6">
        <button v-for="t in overviewTiles" :key="t.label" class="bg-white px-5 py-4 text-left hover:bg-primary-50/50" @click="goTo(t.tab)">
          <div class="font-serif text-2xl text-primary-900 tabular-nums">{{ t.value }}</div>
          <div class="text-xs text-primary-500 mt-0.5">{{ t.label }}</div>
        </button>
      </div>

      <h2 class="text-xs font-medium text-primary-400 uppercase tracking-widest mb-3">Content</h2>
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

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <NuxtLink to="/ask?scope=all" class="block bg-white rounded-2xl border border-primary-100 p-5 hover:border-primary-300 transition-colors">
          <h2 class="font-serif text-lg font-bold text-primary-900">Ask questions</h2>
          <p class="text-sm text-primary-500 mt-1">Everyone's questions and briefings</p>
        </NuxtLink>
      </div>
    </div>

    <!-- ═══ AI ═══ -->
    <div v-show="tab === 'ai'">
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
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-primary-500">Quick setup:</span>
          <button v-for="ps in AI_PRESETS" :key="ps.id" type="button" class="text-xs px-2.5 py-1 rounded-full ring-1 ring-primary-200 hover:ring-primary-400" @click="applyPreset(ps)">{{ ps.name }}</button>
          <span class="text-[11px] text-primary-400">Fills in the details; paste your API key, add, then use “Edit / change model” → “List models”.</span>
        </div>
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

      <!-- Model per task -->
      <div v-if="aiConfig?.tasks?.length && aiConfig?.providers?.length" class="border-t border-primary-100 mt-6 pt-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h3 class="text-sm font-semibold text-primary-800">Model per task</h3>
          <span class="text-[11px] text-primary-400">Tasks left on “Default” use the active model{{ activeProviderName ? ` (${activeProviderName})` : '' }}.</span>
        </div>
        <p class="text-xs text-primary-400 mb-4">Use a stronger model where quality matters most and a faster, cheaper one for short or interactive tasks. Add models with “+ Model with this key” above.</p>
        <div class="grid md:grid-cols-2 gap-x-8 gap-y-5">
          <div v-for="g in taskGroups" :key="g.name">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-primary-500 mb-2">{{ g.name }}</div>
            <div class="space-y-2">
              <div v-for="t in g.tasks" :key="t.id" class="grid grid-cols-[1fr_12rem] items-center gap-3">
                <div class="min-w-0">
                  <div class="text-sm text-primary-800">{{ t.label }}</div>
                  <div class="text-[11px] text-primary-400 truncate" :title="t.hint">{{ t.hint }}</div>
                </div>
                <select v-model="taskForm[t.id]" class="w-full border border-primary-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  <option value="">Default</option>
                  <option v-for="p in aiConfig.providers.filter((x: any) => x.enabled)" :key="p.id" :value="p.id">{{ p.name }} ({{ p.model }})</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 mt-5">
          <button class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800" @click="saveTaskModels">Save task models</button>
          <button class="text-sm px-4 py-2 rounded-lg bg-primary-100 text-primary-600" @click="resetTaskModels">All on default</button>
          <span v-if="taskMsg" class="text-xs" :class="taskMsg.startsWith('Error') ? 'text-red-600' : 'text-green-700'">{{ taskMsg }}</span>
        </div>
      </div>

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

    <!-- AI usage and cost -->
    <div id="ai-usage" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8 scroll-mt-24">
      <VizTip />
      <div class="flex flex-wrap items-baseline justify-between gap-3 mb-1">
        <h2 class="font-serif text-xl font-bold text-primary-900">AI usage and cost</h2>
        <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist" aria-label="Period">
          <button v-for="d in [7, 30, 90]" :key="d" role="tab" :aria-selected="usageDays === d" class="px-3 py-1 rounded-full"
            :class="usageDays === d ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="usageDays = d; loadUsage()">{{ d }} days</button>
        </div>
      </div>
      <p class="text-xs text-primary-500 mb-4">Tokens are counted from every AI call the site and its data scripts make. Costs are estimates from the prices you enter below (USD per million tokens); check your provider's price page.</p>
      <template v-if="usage">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-px bg-primary-100 rounded-xl overflow-hidden ring-1 ring-primary-100 mb-5">
          <div v-for="t in usageTiles" :key="t.label" class="bg-white px-4 py-3">
            <div class="font-serif text-2xl text-primary-900 tabular-nums">{{ t.value }}</div>
            <div class="text-[11px] text-primary-500 mt-0.5">{{ t.label }}</div>
          </div>
        </div>

        <div class="text-sm font-medium text-primary-900">{{ usageHasCost ? 'Estimated cost per day' : 'Tokens per day' }}</div>
        <div class="flex items-end gap-[2px] h-28 mt-2 mb-1 border-b border-primary-100">
          <div v-for="d in usage.series" :key="d.day" class="flex-1 h-full flex flex-col justify-end" tabindex="0"
            @mousemove="showTip($event, fmtDay(d.day), usageTipLines(d))" @focus="showTip($event, fmtDay(d.day), usageTipLines(d))" @mouseleave="hideTip" @blur="hideTip">
            <div class="w-full rounded-t-[3px]" :class="usageVal(d) ? 'bg-[#2a78d6]' : 'bg-primary-100'" :style="{ height: usageVal(d) ? Math.max(4, usageVal(d) / usageMax * 100) + '%' : '2px' }" />
          </div>
        </div>
        <div class="flex justify-between text-[10px] text-primary-400 mb-6"><span>{{ fmtDay(usage.series[0]?.day) }}</span><span>{{ fmtDay(usage.series[usage.series.length - 1]?.day) }}</span></div>

        <div class="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 class="text-sm font-semibold text-primary-800 mb-2">By task</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead><tr class="text-left text-primary-400 border-b border-primary-100"><th class="py-1.5 font-medium">Task</th><th class="py-1.5 font-medium text-right">Calls</th><th class="py-1.5 font-medium text-right">Tokens in / out</th><th class="py-1.5 font-medium text-right">Cost</th></tr></thead>
                <tbody>
                  <tr v-for="t in usage.byTask" :key="t.id" class="border-b border-primary-50">
                    <td class="py-1.5 text-primary-800">{{ t.label }}<span v-if="t.errors" class="text-red-500"> · {{ t.errors }} failed</span></td>
                    <td class="py-1.5 text-right tabular-nums">{{ t.calls.toLocaleString() }}</td>
                    <td class="py-1.5 text-right tabular-nums text-primary-500">{{ fmtTok(t.input) }} / {{ fmtTok(t.output) }}</td>
                    <td class="py-1.5 text-right tabular-nums">{{ fmtCost(t.cost, t.unpriced) }}</td>
                  </tr>
                  <tr v-if="!usage.byTask.length"><td colspan="4" class="py-3 text-primary-400">No AI calls recorded in this period yet.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-primary-800 mb-2">By model, with prices (USD per 1M tokens)</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead><tr class="text-left text-primary-400 border-b border-primary-100"><th class="py-1.5 font-medium">Model</th><th class="py-1.5 font-medium text-right">Tokens</th><th class="py-1.5 font-medium">Input</th><th class="py-1.5 font-medium">Cached</th><th class="py-1.5 font-medium">Output</th></tr></thead>
                <tbody>
                  <tr v-for="m in usageModels" :key="m.model" class="border-b border-primary-50">
                    <td class="py-1.5 text-primary-800 font-mono text-[11px] pr-2">{{ m.model }}</td>
                    <td class="py-1.5 text-right tabular-nums text-primary-500 pr-2">{{ fmtTok(m.input + m.output) }}</td>
                    <td class="py-1"><input v-model="priceForm[m.model].input" inputmode="decimal" class="w-16 border border-primary-200 rounded px-1.5 py-0.5" :aria-label="`${m.model} input price`" placeholder="–"></td>
                    <td class="py-1"><input v-model="priceForm[m.model].cached" inputmode="decimal" class="w-16 border border-primary-200 rounded px-1.5 py-0.5" :aria-label="`${m.model} cached input price`" placeholder="–"></td>
                    <td class="py-1"><input v-model="priceForm[m.model].output" inputmode="decimal" class="w-16 border border-primary-200 rounded px-1.5 py-0.5" :aria-label="`${m.model} output price`" placeholder="–"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex items-center gap-3 mt-2">
              <button class="text-xs px-3 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800" @click="savePrices">Save prices</button>
              <span v-if="priceMsg" class="text-xs text-primary-500">{{ priceMsg }}</span>
            </div>
          </div>
        </div>

        <div v-if="usage.asks.priciest.length" class="mt-6">
          <h3 class="text-sm font-semibold text-primary-800 mb-2">Most expensive Ask questions</h3>
          <ul class="text-xs divide-y divide-primary-50">
            <li v-for="a in usage.asks.priciest" :key="a.id" class="py-1.5 flex justify-between gap-3">
              <NuxtLink :to="`/ask?id=${a.id}`" class="text-primary-800 hover:text-accent-700 truncate">{{ a.question }}</NuxtLink>
              <span class="shrink-0 tabular-nums text-primary-500">{{ fmtTok(a.input + a.output) }} tokens · {{ a.cost === null ? 'no price' : '$' + a.cost.toFixed(3) }}</span>
            </li>
          </ul>
        </div>
      </template>
      <div v-else class="text-sm text-primary-400">Loading…</div>
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

      <div class="grid grid-cols-3 gap-px bg-primary-100 rounded-xl overflow-hidden ring-1 ring-primary-100 mb-4 text-center">
        <div class="bg-white py-3"><div class="font-serif text-2xl text-primary-900">{{ cacheStats?.totalEntries || 0 }}</div><div class="text-[11px] text-primary-500">saved analyses</div></div>
        <div class="bg-white py-3"><div class="font-serif text-2xl text-emerald-700">{{ cacheFresh }}</div><div class="text-[11px] text-primary-500">still fresh</div></div>
        <div class="bg-white py-3"><div class="font-serif text-2xl text-primary-400">{{ (cacheStats?.totalEntries || 0) - cacheFresh }}</div><div class="text-[11px] text-primary-500">expired</div></div>
      </div>
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <input v-model="cacheQuery" type="search" placeholder="Find an analysis (e.g. country:FRA)" aria-label="Find a saved analysis" class="flex-1 min-w-[12rem] border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
        <button @click="clearExpiredCache" class="text-xs px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50">Clear expired</button>
        <button @click="clearAllCache" class="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">{{ confirmClearAll ? 'Click again to clear all' : 'Clear all' }}</button>
      </div>
      <div v-if="cacheQuery" class="space-y-1.5">
        <div v-for="entry in cacheMatches" :key="entry.key" class="flex items-center justify-between gap-2 border border-primary-100 rounded-lg px-3 py-2">
          <div class="min-w-0 text-xs">
            <span class="text-sm font-medium text-primary-800">{{ entry.key }}</span>
            <span class="text-primary-400 ml-2">{{ entry.model }}</span>
            <span class="ml-2" :class="entry.expired ? 'text-primary-400' : 'text-emerald-700'">{{ entry.expired ? 'expired' : formatTime(entry.generatedAt) }}</span>
          </div>
          <button @click="clearCacheEntry(entry.key)" class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Clear</button>
        </div>
        <p v-if="!cacheMatches.length" class="text-xs text-primary-400">No saved analysis matches.</p>
      </div>
    </div>

        </div>

    <!-- ═══ DATA ═══ -->
    <div v-show="tab === 'data'">
    <!-- Data health -->
    <div id="data-health" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-6 scroll-mt-24">
      <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 class="font-serif text-xl font-bold text-primary-900">Data health</h2>
        <button class="text-xs text-accent-600 hover:underline" @click="loadHealth">Check again</button>
      </div>
      <p class="text-xs text-primary-500 mb-4">Every job runs with a time limit, one retry and a check that its files are valid; a broken download never replaces good data. Checked hourly{{ health ? `, last at ${formatTime(health.generatedAt)}` : '' }}.</p>
      <div v-if="health" class="space-y-4">
        <div class="flex flex-wrap gap-2 text-xs">
          <span v-for="k in ['ok','running','stale','failing','disabled']" v-show="health.counts[k]" :key="k" class="px-2.5 py-1 rounded-full font-medium" :class="HEALTH_STYLE[k]">{{ health.counts[k] }} {{ HEALTH_LABEL[k].toLowerCase() }}</span>
        </div>
        <div v-if="health.problems.length" class="rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3">
          <div class="text-sm font-medium text-red-800 mb-1">Needs attention</div>
          <ul class="text-sm text-red-700 list-disc pl-5 space-y-0.5"><li v-for="p in health.problems" :key="p">{{ p }}</li></ul>
        </div>
        <div v-else class="rounded-xl bg-green-50 ring-1 ring-green-200 px-4 py-3 text-sm text-green-800">All scheduled data is refreshing on time.</div>

        <div v-if="health.votingGap?.latestVote" class="rounded-xl ring-1 px-4 py-3 text-sm" :class="health.votingGap.missingRecordedVotes ? 'bg-amber-50 ring-amber-200 text-amber-900' : 'bg-primary-50 ring-primary-100 text-primary-700'">
          <div class="font-medium">Per-country General Assembly votes run to {{ fmtDay(health.votingGap.latestVote) }}</div>
          <p v-if="health.votingGap.missingRecordedVotes" class="mt-1">
            {{ health.votingGap.missingRecordedVotes }} recorded votes since then ({{ fmtDay(health.votingGap.firstMissing) }} to {{ fmtDay(health.votingGap.lastMissing) }}) are known only as totals.
            The UN Digital Library blocks automated downloads, so download the latest "GA voting" CSV from
            <a href="https://digitallibrary.un.org/record/4060887" target="_blank" rel="noopener" class="underline">the UN Digital Library</a>
            and upload it under <a href="#upload-votes" class="underline">Upload a newer voting file</a>.
          </p>
          <p v-else class="mt-1">No newer recorded votes are known.</p>
        </div>

        <details class="text-sm">
          <summary class="cursor-pointer text-primary-600">Datasets updated by hand ({{ health.manual.length }})</summary>
          <ul class="mt-2 space-y-1">
            <li v-for="m in health.manual" :key="m.file" class="flex flex-wrap justify-between gap-2 text-xs">
              <span class="text-primary-800">{{ m.label }} <span class="text-primary-400">· {{ m.how }}</span></span>
              <span :class="(m.ageDays || 0) > 120 ? 'text-amber-700' : 'text-primary-500'">{{ m.updatedAt ? `${fmtDay(m.updatedAt)} (${m.ageDays} days ago)` : 'missing' }}</span>
            </li>
          </ul>
        </details>

        <div class="flex flex-wrap items-end gap-2 pt-2 border-t border-primary-100">
          <label class="text-xs text-primary-500 flex-1 min-w-[16rem]">Email alerts to (sent when a problem appears and when it clears)
            <input v-model="alertEmails" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="you@example.org">
          </label>
          <button class="text-sm px-4 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800" @click="saveAlertEmails">Save</button>
        </div>
        <p class="text-[11px] text-primary-400 -mt-2">Mail goes through the exe.dev email gateway, which only delivers to the VM owner and other allowed addresses.</p>
      </div>
      <div v-else class="text-sm text-primary-400">Checking…</div>
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
                <div class="text-xs text-primary-400">{{ job.script }} · <button class="text-accent-600 hover:underline" @click="openLog(job.id)">log</button></div>
                <pre v-if="logFor === job.id" class="mt-2 max-h-72 max-w-[42rem] overflow-auto rounded-lg bg-primary-900 text-primary-50 text-[11px] leading-snug p-3 whitespace-pre-wrap">{{ logText || 'No log yet.' }}</pre>
              </td>
              <td class="px-3 py-2.5 text-xs text-primary-700"><div>{{ describeCron(job.schedule) }}</div><div class="font-mono text-[10px] text-primary-400">{{ job.schedule }}</div></td>
              <td class="px-3 py-2.5">
                <template v-if="hj(job.id)">
                  <div class="text-xs text-primary-500">{{ hj(job.id).lastEnd ? formatTime(hj(job.id).lastEnd) : hj(job.id).refreshedAt ? 'Data from ' + formatTime(hj(job.id).refreshedAt) : 'Never' }}<span v-if="hj(job.id).durationSec" class="text-primary-300"> · {{ Math.round(hj(job.id).durationSec) }}s</span></div>
                  <div v-if="hj(job.id).error" class="text-xs text-red-500 truncate max-w-[240px]" :title="hj(job.id).error">{{ hj(job.id).error }}</div>
                </template>
                <div v-else class="text-xs text-primary-300">–</div>
              </td>
              <td class="px-3 py-2.5">
                <span class="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="HEALTH_STYLE[hj(job.id)?.status || (job.enabled ? 'ok' : 'disabled')]">{{ HEALTH_LABEL[hj(job.id)?.status || (job.enabled ? 'ok' : 'disabled')] }}</span>
                <div v-if="job.maxAgeHours" class="text-[10px] text-primary-400 mt-0.5">expected every {{ job.maxAgeHours >= 48 ? Math.round(job.maxAgeHours / 24) + ' days' : job.maxAgeHours + ' h' }}</div>
              </td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-1.5">
                  <button
                    @click="runCronJob(job.id)"
                    :disabled="runningCronJob === job.id || hj(job.id)?.status === 'running'"
                    class="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                  >{{ runningCronJob === job.id || hj(job.id)?.status === 'running' ? 'Running…' : 'Run now' }}</button>
                  <details class="relative job-menu">
                    <summary class="list-none cursor-pointer text-xs px-2 py-1 rounded bg-primary-50 text-primary-600 hover:bg-primary-100" aria-label="More actions">•••</summary>
                    <div class="absolute right-0 z-10 mt-1 w-36 rounded-lg bg-white shadow-lg ring-1 ring-primary-200 py-1 text-xs">
                      <button class="block w-full text-left px-3 py-1.5 hover:bg-primary-50" @click="closeMenu($event); toggleCronJob(job.id, !job.enabled)">{{ job.enabled ? 'Disable' : 'Enable' }}</button>
                      <button class="block w-full text-left px-3 py-1.5 hover:bg-primary-50" @click="closeMenu($event); editCronJob(job)">Edit schedule</button>
                      <button class="block w-full text-left px-3 py-1.5 hover:bg-primary-50" @click="closeMenu($event); openLog(job.id)">Show log</button>
                      <button class="block w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50" @click="closeMenu($event); deleteCronJob(job.id)">Remove</button>
                    </div>
                  </details>
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

        <!-- Data Refresh -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <div class="flex items-center justify-between mb-6">
        <div><h2 class="font-serif text-xl font-bold text-primary-900">Refresh by hand</h2><p class="text-xs text-primary-500 mt-1">Most data refreshes on its own schedule above; use these for an immediate update or to upload the UN voting file.</p></div>
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
          <div class="text-xs text-primary-400 mb-3">World Bank (statistics, capitals, regions, income) + UNDP</div>
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

    <!-- Data Coverage -->
    <details v-if="coverage" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <summary class="cursor-pointer font-serif text-xl font-bold text-primary-900">Country statistics coverage</summary>
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
    </details>
    </div>

    <!-- ═══ SOURCES ═══ -->
    <div v-show="tab === 'sources'">
      <!-- Coverage -->
      <div v-if="health?.coverage" id="coverage" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8 scroll-mt-24">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">Country coverage</h2>
          <span class="text-xs text-primary-400">UN member states, last {{ health.coverage.days }} days</span>
        </div>
        <p class="text-xs text-primary-500 mb-4">How many statements and news items mention each country. Countries with nothing are searched for individually on every news run.</p>
        <div class="grid grid-cols-3 gap-px bg-primary-100 rounded-xl overflow-hidden ring-1 ring-primary-100 mb-5 text-center">
          <div class="bg-white py-3"><div class="font-serif text-2xl text-primary-900">{{ health.coverage.withStatements }}</div><div class="text-[11px] text-primary-500">with official statements</div></div>
          <div class="bg-white py-3"><div class="font-serif text-2xl text-primary-900">{{ health.coverage.withNews }}</div><div class="text-[11px] text-primary-500">with news</div></div>
          <div class="bg-white py-3"><div class="font-serif text-2xl" :class="health.coverage.none.length ? 'text-amber-700' : 'text-emerald-700'">{{ health.coverage.none.length }}</div><div class="text-[11px] text-primary-500">with nothing (of {{ health.coverage.countries }})</div></div>
        </div>
        <div class="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 class="text-sm font-semibold text-primary-800 mb-2">Key countries</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead><tr class="text-left text-primary-400 border-b border-primary-100"><th class="py-1.5 font-medium">Country</th><th class="py-1.5 font-medium text-right">Statements</th><th class="py-1.5 font-medium text-right">News</th></tr></thead>
                <tbody>
                  <tr v-for="r in [...health.coverage.key].sort((a: any, b: any) => (a.statements + a.news) - (b.statements + b.news))" :key="r.iso3" class="border-b border-primary-50">
                    <td class="py-1.5 text-primary-800">{{ r.name }}</td>
                    <td class="py-1.5 text-right tabular-nums" :class="r.statements ? 'text-primary-600' : 'text-amber-700'">{{ r.statements || 'none' }}</td>
                    <td class="py-1.5 text-right tabular-nums" :class="r.news ? 'text-primary-600' : 'text-amber-700'">{{ r.news || 'none' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="space-y-4">
            <div>
              <h3 class="text-sm font-semibold text-primary-800 mb-1">Nothing in {{ health.coverage.days }} days</h3>
              <p v-if="health.coverage.none.length" class="text-xs text-primary-600 leading-relaxed">{{ health.coverage.none.map((r: any) => r.name).join(', ') }}</p>
              <p v-else class="text-xs text-emerald-700">Every member state appears at least once.</p>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-primary-800 mb-1">Thin (1–4 items)</h3>
              <p class="text-xs text-primary-600 leading-relaxed">{{ health.coverage.thin.map((r: any) => `${r.name} (${r.statements + r.news})`).join(', ') || 'None' }}</p>
            </div>
          </div>
        </div>
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

      <!-- ReliefWeb needs a pre-approved appname -->
      <div class="my-4 rounded-xl ring-1 ring-sky-200 bg-sky-50/50 p-4">
        <div class="text-sm font-semibold text-primary-800">ReliefWeb (OCHA humanitarian reports)</div>
        <p class="text-xs text-primary-500 mt-1 mb-3 leading-relaxed">
          ReliefWeb only answers apps it has approved. Request an appname at
          <a href="https://apidoc.reliefweb.int/parameters#appname" target="_blank" rel="noopener" class="underline">apidoc.reliefweb.int</a>
          (suggested: <code>worldcountrygroups.exe.xyz</code>), then paste the approved name here.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <input v-model="rwAppname" class="border border-primary-200 rounded-lg px-3 py-1.5 text-sm w-72 bg-white" placeholder="approved appname">
          <button class="text-sm px-3 py-1.5 rounded-lg ring-1 ring-primary-200 bg-white hover:bg-primary-50" :disabled="!rwAppname" @click="testReliefweb">Test</button>
          <button class="text-sm px-3 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-40" :disabled="!rwOk" @click="saveReliefweb">Save &amp; enable</button>
          <span v-if="rwMsg" class="text-xs" :class="rwOk ? 'text-green-700' : 'text-red-600'">{{ rwMsg }}</span>
        </div>
        <ul v-if="rwSample.length" class="mt-2 text-[11px] text-primary-500 list-disc pl-4"><li v-for="t in rwSample" :key="t">{{ t }}</li></ul>
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

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <input v-model="srcQuery" type="search" placeholder="Search sources" aria-label="Search sources" class="flex-1 min-w-[12rem] border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
        <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist" aria-label="Show">
          <button v-for="f in SRC_FILTERS" :key="f.v" role="tab" :aria-selected="srcFilter === f.v" class="px-2.5 py-1 rounded-full whitespace-nowrap"
            :class="srcFilter === f.v ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="srcFilter = f.v">{{ f.label }} {{ srcCounts[f.v] }}</button>
        </div>
        <select v-model="srcCategory" class="text-xs border border-primary-200 rounded-lg px-2 py-1.5 bg-white" aria-label="Category">
          <option value="">All categories</option>
          <option v-for="c in srcCategories" :key="c" :value="c">{{ c }}</option>
        </select>
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
            <tr v-for="src in filteredSources" :key="src.id" class="border-b border-primary-50 last:border-0">
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
      <p v-if="newsSources.length && !filteredSources.length" class="text-sm text-primary-400 py-3">No source matches.</p>
      <div v-if="!newsSources.length" class="text-sm text-primary-400">No news sources configured.</div>

      <div v-if="newsMessage" class="mt-4 rounded-lg px-4 py-3 text-sm" :class="newsMessage.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
        {{ newsMessage.text }}
      </div>
    </div>

        </div>

    <!-- ═══ USERS & ACCESS ═══ -->
    <div v-show="tab === 'users'">
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
              <td class="px-3 py-2.5 text-primary-600">
                <form v-if="editingEmail === user.id" class="flex items-center gap-1" @submit.prevent="saveEmail(user)">
                  <input v-model="emailDraft" type="email" class="border border-primary-200 rounded px-2 py-1 text-xs w-48" placeholder="name@example.org" aria-label="Email address">
                  <button class="text-xs px-2 py-1 rounded bg-primary-900 text-white">Save</button>
                  <button type="button" class="text-xs px-1.5 text-primary-500" @click="editingEmail = null">Cancel</button>
                </form>
                <button v-else class="text-left hover:text-accent-700" :title="'Edit email'" @click="editingEmail = user.id; emailDraft = user.email || ''">{{ user.email || 'Add email' }} <span class="text-primary-300 text-[10px]">✎</span></button>
              </td>
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

        </div>

    <!-- ═══ SHARING ═══ -->
    <div v-show="tab === 'sharing'">
      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-6">
        <h2 class="font-serif text-xl font-bold text-primary-900">Create a share link</h2>
        <p class="text-xs text-primary-500 mt-1 mb-4">Anyone with the link can view that one page without an account: read-only, no other pages, no AI requests. You can also use “Share this page” in your user menu on any page, or “Share link” on an Ask answer.</p>
        <form class="grid sm:grid-cols-2 gap-3" @submit.prevent="createShare">
          <label class="text-xs text-primary-500 sm:col-span-2">Page (address or path)
            <input v-model="shareForm.path" list="share-suggestions" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="/elections or https://worldcountrygroups.exe.xyz/countries/bra" required>
            <datalist id="share-suggestions">
              <option v-for="p in SHARE_SUGGESTIONS" :key="p.path" :value="p.path">{{ p.label }}</option>
            </datalist>
          </label>
          <label class="text-xs text-primary-500">Label (shown to you and to the visitor)
            <input v-model="shareForm.label" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. SG race for the ambassador">
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="text-xs text-primary-500">Expires after
              <select v-model.number="shareForm.expiresDays" class="mt-1 w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option :value="1">1 day</option><option :value="7">7 days</option><option :value="30">30 days</option><option :value="90">90 days</option><option :value="0">Never</option>
              </select>
            </label>
            <label class="text-xs text-primary-500">Max. opens (optional)
              <input v-model.number="shareForm.maxViews" type="number" min="1" class="mt-1 w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm" placeholder="unlimited">
            </label>
          </div>
          <div class="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800">Create link</button>
            <span v-if="shareMsg" class="text-xs" :class="shareMsg.ok ? 'text-emerald-700' : 'text-red-600'">{{ shareMsg.text }}</span>
          </div>
        </form>
      </div>

      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 class="font-serif text-xl font-bold text-primary-900">Shared links</h2>
          <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist">
            <button v-for="f in ['active', 'all']" :key="f" role="tab" :aria-selected="shareFilter === f" class="px-2.5 py-1 rounded-full"
              :class="shareFilter === f ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="shareFilter = f">{{ f === 'active' ? 'Active' : 'All' }}</button>
          </div>
        </div>
        <p v-if="!shownLinks.length" class="text-sm text-primary-400">No {{ shareFilter === 'active' ? 'active ' : '' }}links yet.</p>
        <ul class="divide-y divide-primary-100">
          <li v-for="l in shownLinks" :key="l.id" class="py-3 flex flex-wrap items-start gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium text-primary-900">{{ l.label }}</span>
                <span class="text-[11px] px-2 py-0.5 rounded-full" :class="SHARE_STYLE[l.status]">{{ l.status }}</span>
              </div>
              <NuxtLink :to="l.path" class="text-xs text-accent-700 hover:underline break-all">{{ l.path }}</NuxtLink>
              <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-primary-700">
                <span><strong class="tabular-nums">{{ l.access.opens }}</strong> {{ l.access.opens === 1 ? 'click' : 'clicks' }}<span v-if="l.maxViews" class="text-primary-400"> (limit {{ l.maxViews }})</span></span>
                <span><strong class="tabular-nums">{{ l.access.visitors }}</strong> {{ l.access.visitors === 1 ? 'device' : 'devices' }}</span>
                <span><strong class="tabular-nums">{{ l.access.ips }}</strong> IP {{ l.access.ips === 1 ? 'address' : 'addresses' }}</span>
                <span><strong class="tabular-nums">{{ l.access.views }}</strong> pages viewed</span>
                <span v-if="l.access.previews" class="text-primary-500">{{ l.access.previews }} link {{ l.access.previews === 1 ? 'preview' : 'previews' }} (not counted)</span>
                <span v-if="l.access.refused" class="text-amber-700">{{ l.access.refused }} refused</span>
              </div>
              <div class="text-[11px] text-primary-400 mt-0.5">
                last click {{ l.access.lastOpen ? formatTime(l.access.lastOpen) : 'never' }}
                · created {{ formatTime(l.createdAt) }} by {{ l.createdBy }}
                · {{ l.expiresAt ? (l.status === 'expired' ? 'expired ' : 'expires ') + formatTime(l.expiresAt) : 'no expiry' }}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100" @click="copyShare(l)">{{ copiedShare === l.id ? 'Copied' : 'Copy link' }}</button>
              <button class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100" :aria-expanded="logOpen === l.id" @click="toggleLog(l.id)">{{ logOpen === l.id ? 'Hide log' : 'Access log' }}</button>
              <button v-if="l.status !== 'revoked'" class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100" @click="shareAction(l, 'extend', 30)">+30 days</button>
              <button v-if="l.status !== 'revoked'" class="text-xs px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100" @click="shareAction(l, 'revoke')">Revoke</button>
              <button v-else class="text-xs px-2.5 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100" @click="shareAction(l, 'restore')">Restore</button>
              <button class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100" @click="deleteShare(l)">{{ confirmDeleteShare === l.id ? 'Click again' : 'Delete' }}</button>
            </div>
            <div v-if="logOpen === l.id" class="w-full">
              <AccessLog :id="l.id" />
            </div>
          </li>
        </ul>
        <div v-if="refusedUnknown" class="mt-4 text-xs text-primary-600">
          <button class="text-accent-700 hover:underline" @click="toggleLog('refused')">{{ logOpen === 'refused' ? 'Hide' : 'Show' }} {{ refusedUnknown }} {{ refusedUnknown === 1 ? 'attempt' : 'attempts' }} with unknown links</button>
          <AccessLog v-if="logOpen === 'refused'" id="refused" />
        </div>
        <p class="text-[11px] text-primary-400 mt-4">Every click is logged with time, IP address, browser and device, language and the referring page, plus the pages the visitor then views. A random id kept on the visitor's browser separates people from repeat visits. Previews made by WhatsApp, Slack, email scanners and similar are logged separately and don't count as clicks. Logs are kept for a year.</p>
        <p class="text-[11px] text-primary-400 mt-1">Revoking stops a link at once, including for people who already opened it; deleting also removes it from this list. Visitors can't make AI requests or see anything outside the shared page.</p>
      </div>
    </div>

    <!-- ═══ BACKUP ═══ -->
    <div v-show="tab === 'backup'">
      <AdminBackupPanel class="mb-6" />
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

const AI_PRESETS = [
  { id: 'openai', name: 'OpenAI', type: 'openai', baseUrl: '', model: 'gpt-6.1-sol' },
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic', baseUrl: '', model: 'claude-sonnet-5-5' },
  // Groq serves open models very fast and cheaply through an OpenAI-compatible API
  { id: 'groq', name: 'Groq', type: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' },
]
function applyPreset(ps: any) {
  const taken = new Set((aiConfig.value?.providers || []).map((p: any) => p.id))
  let id = ps.id
  for (let i = 2; taken.has(id); i++) id = `${ps.id}-${i}`
  Object.assign(aiForm, { id, name: `${ps.name} ${ps.model.split('/').pop()}`, type: ps.type, baseUrl: ps.baseUrl, model: ps.model })
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
// "gpt-6-luna" -> "GPT-6 Luna", "gpt-5.4-mini" -> "GPT-5.4 Mini"
function prettyModel(m: string) {
  const parts = m.split('-')
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
  if (/^gpt$/i.test(parts[0]) && parts[1]) return [`GPT-${parts[1]}`, ...parts.slice(2).map(cap)].join(' ')
  return parts.map((w, i) => (i === 0 ? cap(w) : cap(w))).join(' ')
}

async function saveEditAI(id: string, thenTest = false) {
  aiMsg.value = ''
  try {
    // keep the display name in step with the model ("OpenAI GPT-6.1 Sol" -> "OpenAI GPT-6 Luna")
    const orig = aiEditOrigModel.value
    const squash = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (orig && aiEdit.model !== orig && squash(aiEdit.name).includes(squash(orig))) {
      const vendor = aiEdit.name.trim().split(/\s+/)[0]
      aiEdit.name = `${vendor} ${prettyModel(aiEdit.model)}`
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

// ---------- model per task ----------
const taskForm = reactive<Record<string, string>>({})
const taskMsg = ref('')
const activeProviderName = computed(() => aiConfig.value?.providers?.find((p: any) => p.id === aiConfig.value?.activeProvider)?.name || '')
const taskGroups = computed(() => {
  const groups: { name: string; tasks: any[] }[] = []
  for (const t of aiConfig.value?.tasks || []) {
    let g = groups.find(x => x.name === t.group)
    if (!g) groups.push(g = { name: t.group, tasks: [] })
    g.tasks.push(t)
  }
  return groups
})
watch(() => aiConfig.value?.taskModels, (m) => {
  for (const t of aiConfig.value?.tasks || []) taskForm[t.id] = m?.[t.id] || ''
}, { immediate: true })
async function saveTaskModels() {
  taskMsg.value = ''
  try {
    const map = Object.fromEntries(Object.entries(taskForm).filter(([, v]) => v))
    await $fetch('/api/admin/ai-config', { method: 'POST', body: { action: 'save-task-models', taskModels: map } })
    taskMsg.value = Object.keys(map).length ? `Saved: ${Object.keys(map).length} task(s) on a specific model` : 'Saved: all tasks use the default'
    await loadAIConfig()
  } catch (e: any) {
    taskMsg.value = 'Error: ' + (e?.data?.message || 'could not save')
  }
}
function resetTaskModels() { for (const k of Object.keys(taskForm)) taskForm[k] = ''; saveTaskModels() }

// ---------- ReliefWeb appname ----------
const rwAppname = ref('')
const rwOk = ref(false)
const rwMsg = ref('')
const rwSample = ref<string[]>([])
async function testReliefweb() {
  rwMsg.value = 'Testing…'; rwOk.value = false; rwSample.value = []
  try {
    const r = await $fetch<any>('/api/admin/news-sources', { method: 'POST', body: { action: 'test-reliefweb', appname: rwAppname.value } })
    rwOk.value = r.ok; rwMsg.value = r.message; rwSample.value = r.sample || []
  } catch (e: any) { rwMsg.value = e?.data?.statusMessage || 'Test failed' }
}
async function saveReliefweb() {
  try {
    await $fetch('/api/admin/news-sources', { method: 'POST', body: { action: 'update', id: 'reliefweb', appname: rwAppname.value.trim(), enabled: true, lastError: null } })
    rwMsg.value = 'Saved and enabled. Reports arrive with the next news run (every 6 hours).'
  } catch (e: any) { rwOk.value = false; rwMsg.value = e?.data?.statusMessage || 'Could not save' }
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

const confirmClearAll = ref(false)
async function clearAllCache() {
  if (!confirmClearAll.value) { confirmClearAll.value = true; setTimeout(() => { confirmClearAll.value = false }, 3000); return }
  confirmClearAll.value = false
  try {
    await $fetch('/api/admin/ai-cache', { method: 'POST', body: { action: 'clear-all' } })
    await loadCacheStats()
  } catch {}
}
async function clearExpiredCache() {
  try {
    await $fetch('/api/admin/ai-cache', { method: 'POST', body: { action: 'clear-expired' } })
    await loadCacheStats()
  } catch {}
}
const cacheQuery = ref('')
const cacheFresh = computed(() => (cacheStats.value?.entries || []).filter((e: any) => !e.expired).length)
const cacheMatches = computed(() => {
  const q = cacheQuery.value.trim().toLowerCase()
  return (cacheStats.value?.entries || []).filter((e: any) => e.key.toLowerCase().includes(q)).slice(0, 60)
})

async function loadCronJobs() {
  try {
    const res = await $fetch<any>('/api/admin/cron-jobs')
    cronJobs.value = res.jobs || []
    alertEmails.value = (res.alertEmails || []).join(', ')
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
  const started = new Date().toISOString().slice(0, 19)
  try {
    await $fetch<any>('/api/admin/cron-jobs', { method: 'POST', body: { action: 'run-now', id } })
    cronMessage.value = { ok: true, text: `Job "${id}" started. It runs in the background; this page updates when it finishes.` }
    for (let i = 0; i < 360; i++) {
      await new Promise(r => setTimeout(r, 5000))
      await loadHealth()
      const j = hj(id)
      if (j && j.status !== 'running' && (j.lastEnd || '') >= started) {
        cronMessage.value = j.ok ? { ok: true, text: `Job "${id}" finished in ${Math.round(j.durationSec)}s.` } : { ok: false, text: `Job "${id}" failed: ${j.error}` }
        if (logFor.value === id) openLog(id, true)
        break
      }
    }
  } catch (e: any) {
    cronMessage.value = { ok: false, text: e?.data?.statusMessage || 'Failed to start job' }
  } finally {
    runningCronJob.value = null
  }
}

// ---------- tabs and overview ----------
const route = useRoute()
const router = useRouter()
const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' }, { id: 'ai', label: 'AI' }, { id: 'data', label: 'Data' },
  { id: 'sources', label: 'Sources' }, { id: 'users', label: 'Users and access' }, { id: 'sharing', label: 'Sharing' }, { id: 'backup', label: 'Backup' },
] as const
type TabId = typeof ADMIN_TABS[number]['id']
const tab = ref<TabId>((ADMIN_TABS.some(t => t.id === route.query.tab) ? route.query.tab : 'overview') as TabId)
function setTab(id: TabId) {
  tab.value = id
  router.replace({ query: { ...route.query, tab: id === 'overview' ? undefined : id } })
}
function goTo(id: TabId, anchor?: string) {
  setTab(id)
  if (anchor === 'src-failing') { srcFilter.value = 'failing'; anchor = undefined }
  if (anchor) nextTick(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}
function closeMenu(e: Event) { (e.target as HTMLElement).closest('details')?.removeAttribute('open') }

const backupStatus = ref<any>(null)
async function loadBackupStatus() {
  try { backupStatus.value = await $fetch('/api/admin/backup/status') } catch {}
}
async function refreshOverview() {
  await Promise.all([loadHealth(), loadUsage(), loadBackupStatus(), loadUsers(), loadNewsSources(), loadCronJobs()])
}

interface Attention { key: string; level: 'problem' | 'setup' | 'note'; title: string; detail?: string; tab: TabId; anchor?: string; action: string }
const attention = computed<Attention[]>(() => {
  const out: Attention[] = []
  const h = health.value
  for (const p of h?.problems || []) {
    if (p.startsWith('UN voting data')) {
      out.push({ key: 'votes', level: 'problem', title: p, detail: 'The UN Digital Library blocks automated downloads; download the newest voting CSV in your browser and upload it.', tab: 'data', anchor: 'upload-votes', action: 'Upload voting file' })
    } else if (p.startsWith('Backup')) {
      out.push({ key: 'backup-stale', level: 'problem', title: p, tab: 'backup', action: 'Open backup' })
    } else {
      out.push({ key: p, level: 'problem', title: p, tab: 'data', anchor: 'data-health', action: 'See data health' })
    }
  }
  const b = backupStatus.value
  if (b && !b.configured) out.push({ key: 'backup', level: 'setup', title: 'Backups are not set up', detail: 'Enter your Wasabi bucket and access keys to start nightly encrypted backups.', tab: 'backup', action: 'Set up backup' })
  else if (b?.configured && b.lastResult?.lastRunFailed && !out.some(a => a.key === 'backup-stale')) out.push({ key: 'backup-failed', level: 'problem', title: 'The last backup failed', detail: (b.lastResult.errorLines || [])[0], tab: 'backup', action: 'Open backup' })
  const admins = users.value.filter((u: any) => u.role === 'admin')
  if (!alertEmails.value.trim() && !admins.some((u: any) => u.email)) {
    out.push({ key: 'alerts', level: 'setup', title: 'No email address for data alerts', detail: 'Add your email to your user, or an alert address under Data health, to hear when a refresh breaks.', tab: 'users', action: 'Add email' })
  }
  const pending = users.value.filter((u: any) => u.status === 'pending').length
  if (pending) out.push({ key: 'pending', level: 'problem', title: `${pending} ${pending === 1 ? 'person is' : 'people are'} waiting for approval`, tab: 'users', action: 'Review' })
  const unpriced = (usage.value?.byModel || []).filter((m: any) => m.input + m.output > 0 && !m.price)
  if (unpriced.length) out.push({ key: 'prices', level: 'setup', title: `No price set for ${unpriced.map((m: any) => m.model).join(', ')}`, detail: 'Enter USD per million tokens so AI costs show in dollars.', tab: 'ai', anchor: 'ai-usage', action: 'Enter prices' })
  const failing = newsSources.value.filter((x: any) => x.enabled && x.lastError)
  if (failing.length) out.push({ key: 'sources', level: 'problem', title: `${failing.length} news ${failing.length === 1 ? 'source' : 'sources'} failed on the last fetch`, detail: failing.slice(0, 4).map((x: any) => x.name).join(', ') + (failing.length > 4 ? '…' : ''), tab: 'sources', anchor: 'src-failing', action: 'Show failing' })
  const rw = newsSources.value.find((x: any) => /reliefweb/i.test(x.id) && !x.enabled)
  if (rw) out.push({ key: 'reliefweb', level: 'note', title: 'ReliefWeb is waiting for an approved app name', tab: 'sources', action: 'Open sources' })
  return out
})
const tabAlerts = computed(() => {
  const c: Record<string, number> = {}
  for (const a of attention.value) if (a.level !== 'note') c[a.tab] = (c[a.tab] || 0) + 1
  c.overview = attention.value.filter(a => a.level !== 'note').length
  return c
})
const overviewTiles = computed(() => {
  const h = health.value
  const enabled = (h?.jobs || []).filter((j: any) => j.enabled).length
  const u = usage.value
  const b = backupStatus.value
  return [
    { label: 'scheduled datasets up to date', value: h ? `${(h.counts.ok || 0) + (h.counts.running || 0)} / ${enabled}` : '…', tab: 'data' as TabId },
    { label: u?.total?.cost ? 'AI cost, last 30 days' : 'AI tokens, last 30 days', value: u ? (u.total.cost ? '$' + u.total.cost.toFixed(2) : fmtTok(u.total.input + u.total.output)) : '…', tab: 'ai' as TabId },
    { label: 'questions asked, last 30 days', value: u ? String(u.asks.count) : '…', tab: 'ai' as TabId },
    { label: 'last backup', value: !b ? '…' : !b.configured ? 'Not set up' : b.lastResult?.lastFinishedAt ? formatTime(b.lastResult.lastFinishedAt).split(',')[0] : 'Never', tab: 'backup' as TabId },
  ]
})

/** Plain-English reading of the cron expressions the scheduler uses (server time is UTC). */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function describeCron(expr: string): string {
  const f = (expr || '').trim().split(/\s+/)
  if (f.length !== 5) return expr
  const [mi, hr, dom, mon, dow] = f
  const num = (x: string) => /^\d+$/.test(x)
  const at = num(mi) && num(hr) ? `${hr.padStart(2, '0')}:${mi.padStart(2, '0')} UTC` : ''
  const months = mon === '*' ? '' : ` in ${mon.split(',').map(m => MONTHS[Number(m)] || m).join(' and ')}`
  if (num(mi) && hr === '*' && dom === '*' && mon === '*' && dow === '*') return `Every hour at :${mi.padStart(2, '0')}`
  const every = hr.match(/^\*\/(\d+)$/)
  if (num(mi) && every && dom === '*' && dow === '*') return `Every ${every[1]} hours at :${mi.padStart(2, '0')}${months}`
  if (at && dom === '*' && dow === '*') return `Daily at ${at}${months}`
  if (at && dom === '*' && num(dow)) return `${DAYS[Number(dow) % 7]}s at ${at}${months}`
  if (at && num(dom) && dow === '*') return `Monthly on the ${dom}${['th', 'st', 'nd', 'rd'][(Number(dom) % 10 > 3 || [11, 12, 13].includes(Number(dom))) ? 0 : Number(dom) % 10]} at ${at}${months}`
  return expr
}

// ---------- news source filters ----------
const SRC_FILTERS = [{ v: 'all', label: 'All' }, { v: 'failing', label: 'Failing' }, { v: 'enabled', label: 'On' }, { v: 'disabled', label: 'Off' }]
const srcFilter = ref('all')
const srcQuery = ref('')
const srcCategory = ref('')
const srcCategories = computed(() => [...new Set(newsSources.value.map((x: any) => x.category).filter(Boolean))].sort())
const srcMatch = (x: any, f: string) => f === 'all' || (f === 'failing' && x.enabled && !!x.lastError) || (f === 'enabled' && x.enabled) || (f === 'disabled' && !x.enabled)
const srcCounts = computed(() => Object.fromEntries(SRC_FILTERS.map(f => [f.v, newsSources.value.filter((x: any) => srcMatch(x, f.v)).length])))
const filteredSources = computed(() => {
  const q = srcQuery.value.trim().toLowerCase()
  return newsSources.value
    .filter((x: any) => srcMatch(x, srcFilter.value) && (!srcCategory.value || x.category === srcCategory.value) && (!q || `${x.name} ${x.url} ${x.id}`.toLowerCase().includes(q)))
    .sort((a: any, b: any) => Number(!!(b.enabled && b.lastError)) - Number(!!(a.enabled && a.lastError)))
})

// ---------- user email ----------
const editingEmail = ref<string | null>(null)
const emailDraft = ref('')
async function saveEmail(user: any) {
  try {
    const r = await $fetch<any>(`/api/admin/users/${user.id}/email`, { method: 'POST', body: { email: emailDraft.value } })
    user.email = r.email
    editingEmail.value = null
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Could not save the email address')
  }
}

// ---------- AI usage and cost ----------
const usage = ref<any>(null)
const usageDays = ref(30)
const priceForm = reactive<Record<string, { input: string; cached: string; output: string }>>({})
const priceMsg = ref('')
const { show: showTip, hide: hideTip } = useVizTip()
async function loadUsage() {
  try {
    usage.value = await $fetch('/api/admin/ai-usage', { query: { days: usageDays.value } })
    for (const m of usage.value.models as string[]) {
      if (!priceForm[m]) {
        const p = usage.value.prices[m]
        priceForm[m] = { input: p ? String(p.input) : '', cached: p?.cached !== undefined ? String(p.cached) : '', output: p ? String(p.output) : '' }
      }
    }
  } catch {}
}
const usageModels = computed(() => {
  const seen = new Map((usage.value?.byModel || []).map((m: any) => [m.model, m]))
  return (usage.value?.models || []).map((m: string) => seen.get(m) || { model: m, input: 0, output: 0 })
})
async function savePrices() {
  const prices: Record<string, any> = {}
  for (const [m, p] of Object.entries(priceForm)) {
    if (p.input === '' && p.output === '') continue
    prices[m] = { input: Number(p.input || 0), output: Number(p.output || 0), ...(p.cached !== '' ? { cached: Number(p.cached) } : {}) }
  }
  try {
    await $fetch('/api/admin/ai-usage', { method: 'POST', body: { prices } })
    priceMsg.value = 'Saved.'
    await loadUsage()
  } catch { priceMsg.value = 'Could not save.' }
}
const usageHasCost = computed(() => (usage.value?.total?.cost || 0) > 0)
const usageVal = (d: any) => (usageHasCost.value ? d.cost : d.input + d.output)
const usageMax = computed(() => Math.max(1e-9, ...(usage.value?.series || []).map(usageVal)))
const fmtTok = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n || 0))
const fmtCost = (c: number, unpriced = 0) => (c > 0 ? '$' + (c < 1 ? c.toFixed(3) : c.toFixed(2)) : '') + (unpriced ? (c > 0 ? ' + ' : '') + 'no price' : c > 0 ? '' : '$0')
const usageTipLines = (d: any) => [
  { text: `${fmtTok(d.input)} in, ${fmtTok(d.output)} out`, color: '#2a78d6' },
  { text: `${d.calls} calls${d.cost ? ` · $${d.cost.toFixed(3)}` : ''}` },
]
const usageTiles = computed(() => {
  const u = usage.value
  if (!u) return []
  return [
    { label: `AI calls, last ${u.days} days`, value: u.total.calls.toLocaleString() },
    { label: 'tokens in / out', value: `${fmtTok(u.total.input)} / ${fmtTok(u.total.output)}` },
    { label: u.total.unpriced ? 'estimated cost (some models unpriced)' : 'estimated cost', value: u.total.cost ? '$' + u.total.cost.toFixed(2) : '–' },
    { label: `per Ask question (${u.asks.count} asked)`, value: u.asks.avgCost !== null ? '$' + u.asks.avgCost.toFixed(3) : fmtTok(u.asks.avgTokens) + ' tok' },
  ]
})

// ---------- share links ----------
const SHARE_SUGGESTIONS = [
  { path: '/today', label: 'Today at the UN' }, { path: '/elections', label: 'Secretary-General race' }, { path: '/elections?tab=council', label: 'Security Council elections' },
  { path: '/news', label: 'News analysis' }, { path: '/partners/trade', label: 'Trade partners' }, { path: '/partners/donors', label: 'Donor tracker' },
  { path: '/un', label: 'UN Monitor' }, { path: '/speeches', label: 'General Debate speeches' }, { path: '/conflicts', label: 'Conflicts' },
]
const SHARE_STYLE: Record<string, string> = { active: 'bg-green-100 text-green-700', expired: 'bg-primary-100 text-primary-500', revoked: 'bg-amber-100 text-amber-800', 'used up': 'bg-primary-100 text-primary-500' }
const shareLinks = ref<any[]>([])
const refusedUnknown = ref(0)
const logOpen = ref('')
function toggleLog(id: string) { logOpen.value = logOpen.value === id ? '' : id }
const AccessLog = defineComponent({
  props: { id: { type: String, required: true } },
  setup(props) {
    const entries = ref<any[] | null>(null)
    const load = async () => { try { entries.value = (await $fetch<any>(`/api/admin/share-links/${props.id}/log`)).entries } catch { entries.value = [] } }
    onMounted(load)
    const EV: Record<string, [string, string]> = { open: ['click', 'bg-green-100 text-green-700'], view: ['page view', 'bg-primary-100 text-primary-600'], preview: ['preview', 'bg-sky-50 text-sky-700'], refused: ['refused', 'bg-amber-100 text-amber-800'] }
    return () => {
      const list = entries.value
      if (list === null) return h('p', { class: 'text-xs text-primary-400 mt-2' }, 'Loading…')
      return h('div', { class: 'mt-2 rounded-xl ring-1 ring-primary-100 overflow-x-auto' }, [
        h('div', { class: 'flex items-center justify-between px-3 py-2 bg-primary-50/60 text-xs' }, [
          h('span', { class: 'text-primary-600' }, `${list.length} ${list.length === 1 ? 'entry' : 'entries'}, newest first`),
          h('a', { href: `/api/admin/share-links/${props.id}/log?format=csv`, class: 'text-accent-700 hover:underline' }, 'Download CSV'),
        ]),
        list.length ? h('table', { class: 'w-full text-xs' }, [
          h('thead', h('tr', { class: 'text-left text-primary-400 border-b border-primary-100' }, ['Time', 'Event', 'IP address', 'Device', 'Language', 'Page / from', 'Visitor'].map(c => h('th', { class: 'px-3 py-1.5 font-medium whitespace-nowrap' }, c)))),
          h('tbody', list.map((e: any) => h('tr', { class: 'border-b border-primary-50 align-top' }, [
            h('td', { class: 'px-3 py-1.5 whitespace-nowrap tabular-nums' }, formatTime(e.t)),
            h('td', { class: 'px-3 py-1.5' }, h('span', { class: `px-1.5 py-0.5 rounded-full ${EV[e.event]?.[1] || ''}` }, (EV[e.event]?.[0] || e.event) + (e.reason ? `: ${e.reason}` : ''))),
            h('td', { class: 'px-3 py-1.5 font-mono whitespace-nowrap', title: e.forwardedFor ? `Forwarded for: ${e.forwardedFor}` : '' }, e.ip || '—'),
            h('td', { class: 'px-3 py-1.5 whitespace-nowrap', title: e.ua }, e.device),
            h('td', { class: 'px-3 py-1.5' }, e.lang || '—'),
            h('td', { class: 'px-3 py-1.5 max-w-[16rem] truncate', title: e.event === 'view' ? e.path : (e.referer || '') }, e.event === 'view' ? e.path : (e.referer ? `from ${e.referer}` : '—')),
            h('td', { class: 'px-3 py-1.5 font-mono text-primary-400' }, e.visitor ? e.visitor.slice(0, 6) : '—'),
          ]))),
        ]) : h('p', { class: 'px-3 py-3 text-xs text-primary-400' }, 'No activity yet.'),
      ])
    }
  },
})
const shareFilter = ref('active')
const shownLinks = computed(() => shareLinks.value.filter((l: any) => shareFilter.value === 'all' || l.status === 'active'))
const shareForm = reactive({ path: '', label: '', expiresDays: 30, maxViews: null as number | null })
const shareMsg = ref<{ ok: boolean; text: string } | null>(null)
const copiedShare = ref('')
const confirmDeleteShare = ref('')
const shareUrlOf = (l: any) => `${location.origin}/s/${l.token}`
async function loadShares() {
  try { const r = await $fetch<any>('/api/admin/share-links'); shareLinks.value = r.links || []; refusedUnknown.value = r.refusedUnknown || 0 } catch {}
}
async function createShare() {
  shareMsg.value = null
  try {
    const r = await $fetch<any>('/api/admin/share-links', { method: 'POST', body: { ...shareForm } })
    await loadShares()
    const url = shareUrlOf(r.link)
    try { await navigator.clipboard.writeText(url); shareMsg.value = { ok: true, text: `Link created and copied: ${url}` } } catch { shareMsg.value = { ok: true, text: `Link created: ${url}` } }
    shareForm.path = ''; shareForm.label = ''; shareForm.maxViews = null
  } catch (e: any) {
    shareMsg.value = { ok: false, text: e?.data?.statusMessage || 'Could not create the link' }
  }
}
async function copyShare(l: any) {
  try { await navigator.clipboard.writeText(shareUrlOf(l)); copiedShare.value = l.id; setTimeout(() => { copiedShare.value = '' }, 2000) } catch { prompt('Copy this link', shareUrlOf(l)) }
}
async function shareAction(l: any, action: string, days?: number) {
  await $fetch(`/api/admin/share-links/${l.id}`, { method: 'POST', body: { action, days } })
  await loadShares()
}
async function deleteShare(l: any) {
  if (confirmDeleteShare.value !== l.id) { confirmDeleteShare.value = l.id; setTimeout(() => { if (confirmDeleteShare.value === l.id) confirmDeleteShare.value = '' }, 3000); return }
  confirmDeleteShare.value = ''
  await shareAction(l, 'delete')
}

// ---------- data health ----------
const health = ref<any>(null)
const alertEmails = ref('')
const HEALTH_LABEL: Record<string, string> = { ok: 'Up to date', running: 'Running', stale: 'Stale', failing: 'Failing', disabled: 'Disabled' }
const HEALTH_STYLE: Record<string, string> = {
  ok: 'bg-green-100 text-green-700', running: 'bg-blue-100 text-blue-700', stale: 'bg-amber-100 text-amber-800',
  failing: 'bg-red-100 text-red-700', disabled: 'bg-primary-100 text-primary-400',
}
const hj = (id: string) => (health.value?.jobs || []).find((j: any) => j.id === id)
const fmtDay = (d: string) => (d ? new Date(d.length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
async function loadHealth() {
  try { health.value = await $fetch('/api/admin/data-health') } catch {}
}
async function saveAlertEmails() {
  try {
    const res = await $fetch<any>('/api/admin/cron-jobs', { method: 'POST', body: { action: 'alerts', emails: alertEmails.value } })
    alertEmails.value = (res.alertEmails || []).join(', ')
    cronMessage.value = { ok: true, text: res.alertEmails.length ? `Alerts go to ${alertEmails.value}.` : 'Email alerts switched off.' }
  } catch (e: any) {
    cronMessage.value = { ok: false, text: e?.data?.statusMessage || 'Could not save' }
  }
}
const logFor = ref<string | null>(null)
const logText = ref('')
async function openLog(id: string, keep = false) {
  if (logFor.value === id && !keep) { logFor.value = null; return }
  logFor.value = id
  logText.value = 'Loading…'
  try { logText.value = ((await $fetch<any>('/api/admin/job-log', { query: { id } })).text || '').split('\n').slice(-200).join('\n') } catch { logText.value = 'Could not load the log.' }
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
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
    loadHealth(),
    loadUsage(),
    loadBackupStatus(),
    loadShares(),
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
