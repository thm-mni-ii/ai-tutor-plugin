<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  isOpen: boolean
  backendUrl: string
}>()

const emit = defineEmits<{
  close: []
}>()

interface DashboardStats {
  total_sessions: number
  unique_users: number
  upvotes: number
  downvotes: number
  top_scopes: { _id: string; count: number }[]
}

const stats = ref<DashboardStats | null>(null)
const error = ref<string | null>(null)
const isLoading = ref(false)

async function fetchStats() {
  if (!props.isOpen) return
  
  isLoading.value = true
  error.value = null
  try {
    const res = await fetch(`${props.backendUrl}/admin/analytics`)
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }
    stats.value = await res.json()
  } catch (e: any) {
    console.error('Failed to fetch admin stats:', e)
    error.value = 'Fehler beim Laden der Statistiken.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchStats()
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    fetchStats()
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="dashboard-overlay" @click.self="emit('close')">
      <div class="dashboard-modal">
        <div class="dashboard-header">
          <h2>📊 Admin Dashboard</h2>
          <button class="close-btn" @click="emit('close')" aria-label="Schließen">×</button>
        </div>
        
        <div class="dashboard-content">
          <div v-if="isLoading" class="loading-state">Lade Statistiken...</div>
          <div v-else-if="error" class="error-state">{{ error }}</div>
          <div v-else-if="stats" class="stats-grid">
            
            <div class="stat-card">
              <span class="stat-icon">💬</span>
              <div class="stat-info">
                <h3>Gesamte Sessions</h3>
                <p class="stat-value">{{ stats.total_sessions }}</p>
              </div>
            </div>

            <div class="stat-card">
              <span class="stat-icon">👥</span>
              <div class="stat-info">
                <h3>Einzigartige Nutzer</h3>
                <p class="stat-value">{{ stats.unique_users }}</p>
              </div>
            </div>

            <div class="stat-card stat-card--upvotes">
              <span class="stat-icon">👍</span>
              <div class="stat-info">
                <h3>Positive Bewertungen</h3>
                <p class="stat-value">{{ stats.upvotes }}</p>
              </div>
            </div>

            <div class="stat-card stat-card--downvotes">
              <span class="stat-icon">👎</span>
              <div class="stat-info">
                <h3>Negative Bewertungen</h3>
                <p class="stat-value">{{ stats.downvotes }}</p>
              </div>
            </div>
            
            <div class="stat-card stat-card--wide">
              <h3>🏆 Top Funktionen</h3>
              <ul class="top-scopes-list">
                <li v-for="scope in stats.top_scopes" :key="scope._id">
                  <span class="scope-name">{{ scope._id }}</span>
                  <span class="scope-count">{{ scope.count }} Sessions</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dashboard-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dashboard-modal {
  background: var(--jp-layout-color1, #ffffff);
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  border: 1px solid var(--jp-border-color1, #e0e0e0);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--jp-layout-color2, #f5f5f5);
  border-bottom: 1px solid var(--jp-border-color1, #e0e0e0);
}

.dashboard-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--jp-ui-font-color1, #333);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: var(--jp-ui-font-color2, #666);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--jp-layout-color3, #e0e0e0);
  color: var(--jp-ui-font-color1, #333);
}

.dashboard-content {
  padding: 24px;
  overflow-y: auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  background: var(--jp-layout-color1, #ffffff);
  border: 1px solid var(--jp-border-color2, #eee);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.stat-card--wide {
  grid-column: 1 / -1;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.stat-card--wide h3 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.stat-icon {
  font-size: 2rem;
  background: var(--jp-layout-color2, #f5f5f5);
  padding: 12px;
  border-radius: 12px;
}

.stat-info h3 {
  margin: 0;
  font-size: 0.85rem;
  color: var(--jp-ui-font-color2, #666);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  margin: 4px 0 0 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--jp-ui-font-color1, #333);
}

.stat-card--upvotes .stat-icon {
  background: rgba(76, 175, 80, 0.1);
  text-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.stat-card--upvotes .stat-value {
  color: #4CAF50;
}

.stat-card--downvotes .stat-icon {
  background: rgba(244, 67, 54, 0.1);
  text-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
}

.stat-card--downvotes .stat-value {
  color: #F44336;
}

.top-scopes-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
}

.top-scopes-list li {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--jp-border-color2, #eee);
}

.top-scopes-list li:last-child {
  border-bottom: none;
}

.scope-name {
  font-weight: 500;
  color: var(--jp-ui-font-color1, #333);
}

.scope-count {
  color: var(--jp-ui-font-color2, #666);
  background: var(--jp-layout-color2, #f5f5f5);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px;
  color: var(--jp-ui-font-color2, #666);
}

.error-state {
  color: #F44336;
}
</style>
