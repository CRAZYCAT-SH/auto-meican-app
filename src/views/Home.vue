<template>
  <div class="home">

    <!-- 刷新蒙版 -->
    <div v-if="isRefreshing" class="refresh-mask">
      <el-icon class="loading-icon"><Loading /></el-icon>
    </div>

    <!-- 右上角信息栏 -->
    <div class="top-bar">
      <span class="token-info">当前用户：{{ token }}</span>
      <div class="actions">
        <button
          @click="forceRefresh"
          :disabled="isRefreshing"
        >
          <span v-if="isRefreshing">刷新中...</span>
          <span v-else>刷新</span>
        </button>
        <button @click="logout">退出登录</button>
      </div>
    </div>

    <!-- Tab页 -->
    <div class="tab-container">
      <!-- 固定Tab头部 -->
      <div class="fixed-tab-header">
        <el-tabs 
          v-model="activeTab" 
          class="main-tabs" 
          @tab-change="handleTabChange"
        >
        <el-tab-pane label="日历视图" name="calendar">
            <div class="tab-content" :class="slideClass">
              <CalendarTab 
                :order-data="orderData"
                :home-data="homeData"
                :blacklist="blacklistDetail.noOrderDishes"
                :order-history="orderHistory"
                @update:order-data="handleUpdateOrderData"
                @submit-success="handleSubmitSuccess"
                @delete-order="handleDeleteOrder"
              />
            </div>
          </el-tab-pane>
          <el-tab-pane label="菜品视图" name="home">
            <div class="tab-content" :class="slideClass">
              <HomeTab 
                v-model:home-data="homeData"
                :order-data="orderData"
                :blacklist="blacklist"
                @blacklist-update="handleBlacklistUpdate"
                @update:order-data="handleUpdateOrderData"
                @submit-success="handleSubmitSuccess"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="AI点餐" name="auto-order">
            <div class="tab-content" :class="slideClass">
              <AutoOrderTab 
                :blacklist="blacklistDetail.noOrderDishes"
                :expire-date="blacklistDetail.expireDate"
                :likes="blacklistDetail.likes"
                :restrictions="blacklistDetail.restrictions"
                :available-dishes="getAvailableDishes()"
                @submit-all-changes="handleSubmitAllChanges"
                @order-success="handleOrderSuccess"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="订单历史" name="history">
            <div class="tab-content" :class="slideClass">
              <HistoryTab 
                :order-history="orderHistory"
                @delete-order="handleDeleteOrder"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script>
import HomeTab from '@/components/HomeTab.vue'
import HistoryTab from '@/components/HistoryTab.vue'
import AutoOrderTab from '@/components/AutoOrderTab.vue'
import CalendarTab from '@/components/CalendarTab.vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { onBeforeUnmount, getCurrentInstance } from 'vue'

export default {
  name: 'HomePage',
  components: {
    HomeTab,
    HistoryTab,
    AutoOrderTab,
    CalendarTab,
    Loading
  },
  data() {
    return {
      homeData: [],
      token: localStorage.getItem('token') || '无',
      orderData: [],
      activeTab: window.innerWidth <= 768 ? 'calendar' : 'calendar',
      orderHistory: [],
      blacklist: [],
      lastRefreshTime: {
        home: null,
        history: null,
        'auto-order': null
      },
      isRefreshing: false,
      blacklistDetail: {
        noOrderDishes: [],
        expireDate: null,
        likes: '',
        restrictions: ''
      },
      slideClass: '', // 初始化slideClass
      slideDirection: 'none', // 滑动方向
      isAnimating: false,      // 是否正在动画中
      tabHeaderStartX: 0, // Tab头部滑动起始位置
      tabHeaderIsSwiping: false // Tab头部是否正在滑动
    }
  },
  async created() {
    await this.refreshCurrentTab()
  },
  methods: {
    logout() {
      localStorage.removeItem('isLoggedIn')
      localStorage.removeItem('token')
      this.$router.push({ name: 'LoginPage' })
    },
    async handleTabChange(tabName) {
      console.log(`切换到 ${tabName} tab`)
      
      // 根据不同的tab执行不同的刷新逻辑
      switch (tabName) {
        case 'home':
          if (!this.homeData) {
            await this.refreshCurrentTab()
          }
          break
        case 'history':
          if (!this.orderHistory || this.orderHistory.length === 0) {
            await this.refreshCurrentTab()
          }
          break
        case 'auto-order':
          if (!this.blacklist || this.blacklist.length === 0) {
            await this.refreshCurrentTab()
          }
          break
        case 'calendar':
          if (!this.orderHistory || this.orderHistory.length === 0 || !this.homeData || !this.orderData) {
            await this.refreshCurrentTab()
          }
          break
        default:
          console.warn(`未知的tab: ${tabName}`)
      }
    },

    async refreshCurrentTab() {
      const now = Date.now()
      const tabName = this.activeTab
      
      // 如果上次刷新时间不存在或强制刷新
      if (!this.lastRefreshTime[tabName]) {
        try {
          if (tabName === 'home') {
            this.homeData = await api.getHomeData()
          } else if (tabName === 'history') {
            this.orderHistory = await api.getOrderHistory()
          } else if (tabName === 'auto-order') {
            this.blacklistDetail = await api.getAutoOrderInfo()
          } else if (tabName === 'calendar') {
            this.homeData = await api.getHomeData()
            this.orderHistory = await api.getOrderHistory()
          }
          this.lastRefreshTime[tabName] = now
        } catch (error) {
          console.error(`获取${tabName}数据失败:`, error)
          ElMessage.error(`获取${tabName}数据失败`)
        }
      }
    },
    handleSubmitSuccess() {
      this.forceRefresh() // 强制刷新当前tab
    },
    async handleDeleteOrder(orderId) {
      try {
        await api.deleteOrder(orderId)
        ElMessage.success('删除成功')
        // 删除成功后强制刷新当前tab
        await this.forceRefresh()
      } catch (error) {
        console.error('删除订单失败:', error)
        ElMessage.error('删除订单失败')
      }
    },
    async forceRefresh() {
      this.isRefreshing = true
      try {
        // 重置当前tab的刷新时间
        this.lastRefreshTime[this.activeTab] = null
        await this.refreshCurrentTab()
      } catch (error) {
        console.error('刷新失败:', error)
        ElMessage.error('刷新失败')
      } finally {
        this.isRefreshing = false
      }
    },
    switchTab(direction) {
      if (this.isAnimating) return;
      
      this.isAnimating = true;
      this.slideDirection = direction;
      this.slideClass = direction === 'next' ? 'slide-left' : 'slide-right';
      
      // 定义所有tab的顺序
      const tabs = ['calendar','home', 'auto-order', 'history']
      const currentIndex = tabs.indexOf(this.activeTab)
      let newIndex

      if (direction === 'next') {
        newIndex = (currentIndex + 1) % tabs.length
      } else {
        newIndex = (currentIndex - 1 + tabs.length) % tabs.length
      }

      // 设置动画
      setTimeout(() => {
        this.activeTab = tabs[newIndex]
        this.refreshCurrentTab()
        this.isAnimating = false
        this.slideDirection = 'none' // 重置滑动方向
        this.slideClass = '' // 重置动画类
      }, 300) // 动画持续时间
    },
    async handleSubmitAllChanges(data) {
      try {
        const token = localStorage.getItem('token')
        await api.submitAllChanges({
          accountName: token,
          expireDate: data.expireDate,
          likes: data.likes,
          restrictions: data.restrictions,
          noOrderDishes: data.noOrderDishes.join(',')
        })
        
        // 更新本地数据
        this.blacklistDetail = {
          noOrderDishes: data.noOrderDishes,
          expireDate: data.expireDate,
          likes: data.likes,
          restrictions: data.restrictions
        }
        
        ElMessage.success('保存成功')
      } catch (error) {
        console.error('保存失败:', error)
        ElMessage.error('保存失败')
        throw error
      }
    },
    async handleOrderSuccess() {
      // 下单成功后刷新历史记录
      try {
        this.orderHistory = await api.getOrderHistory()
      } catch (error) {
        console.error('刷新订单历史失败:', error)
      }
    },
    getAvailableDishes() {
      // 从 homeData 中提取所有菜品名称和餐厅信息
      if (!this.homeData) return [];
      
      // 如果 homeData 是对象数组(新格式),直接返回
      if (this.homeData.length > 0 && typeof this.homeData[0] === 'object' && this.homeData[0].name) {
        return this.homeData;
      }
      
      // 如果是字符串数组(旧格式),转换为新格式
      const dishes = new Set();
      this.homeData.forEach(item => {
        if (typeof item === 'string') {
          dishes.add(item);
        }
      });
      
      return Array.from(dishes).sort();
    },
    async handleBlacklistUpdate({ type, item }) {
      try {
        if (type === 'add') {
          await api.addToBlacklist(item)
          this.blacklist = [...this.blacklist, item]
        } else if (type === 'remove') {
          await api.removeFromBlacklist(item)
          this.blacklist = this.blacklist.filter(i => i !== item)
        }
      } catch (error) {
        console.error('黑名单更新失败:', error)
        ElMessage.error('黑名单更新失败')
      }
    },
    handleUpdateOrderData(newOrderData) {
      console.log('父组件接收到的新orderData:', newOrderData) // 调试信息
      this.orderData = newOrderData
    },
    // Tab头部滑动开始
    onTabHeaderTouchStart(e) {
      if (window.innerWidth > 768) return
      this.tabHeaderStartX = e.touches[0].pageX
      this.tabHeaderIsSwiping = true
    },
    // Tab头部滑动中
    onTabHeaderTouchMove(e) {
      if (!this.tabHeaderIsSwiping || window.innerWidth > 768) return
      // 阻止默认滑动行为
      e.preventDefault()
    },
    // Tab头部滑动结束
    onTabHeaderTouchEnd(e) {
      if (!this.tabHeaderIsSwiping || window.innerWidth > 768) return
      
      const endX = e.changedTouches[0].pageX
      const deltaX = endX - this.tabHeaderStartX
      const minSwipeDistance = 50 // 最小滑动距离
      
      if (Math.abs(deltaX) > minSwipeDistance) {
        const tabs = ['calendar', 'home', 'auto-order', 'history']
        const currentIndex = tabs.indexOf(this.activeTab)
        let newIndex
        
        if (deltaX > 0) {
          // 向右滑，切换到上一个tab
          newIndex = (currentIndex - 1 + tabs.length) % tabs.length
        } else {
          // 向左滑，切换到下一个tab
          newIndex = (currentIndex + 1) % tabs.length
        }
        
        this.activeTab = tabs[newIndex]
      }
      
      this.tabHeaderIsSwiping = false
    }
  },
  setup() {
    const instance = getCurrentInstance()
    
    // 添加触摸事件相关变量
    let startX = 0
    let startY = 0
    let isTouching = false
    let touchStartTime = 0
    const minSwipeDistance = 80 // 最小滑动距离
    const maxSwipeTime = 250 // 最大滑动时间
    const minHorizontalRatio = 2.5 // 水平/垂直滑动比例阈值
    const maxVerticalDistance = 30 // 最大允许垂直滑动距离

    const onTouchStart = (e) => {
      if (window.innerWidth > 768) return
      startX = e.touches[0].pageX
      startY = e.touches[0].pageY
      isTouching = true
      touchStartTime = Date.now()
    }

    const onTouchMove = (e) => {
      if (!isTouching || window.innerWidth > 768) return
      
      const currentX = e.touches[0].pageX
      const currentY = e.touches[0].pageY
      const deltaX = currentX - startX
      const deltaY = currentY - startY
      
      // 如果垂直滑动距离过大，直接取消滑动
      if (Math.abs(deltaY) > maxVerticalDistance) {
        isTouching = false
        return
      }
      
      // 仅在水平滑动距离大于垂直滑动距离时阻止默认行为
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault()
      }
    }

    const onTouchEnd = (e) => {
      if (!isTouching || window.innerWidth > 768) return
      
      const endX = e.changedTouches[0].pageX
      const endY = e.changedTouches[0].pageY
      const deltaX = endX - startX
      const deltaY = endY - startY
      const swipeTime = Date.now() - touchStartTime
      const horizontalRatio = Math.abs(deltaX) / (Math.abs(deltaY) || 1) // 防止除零
      
      // 判断滑动是否有效
      if (Math.abs(deltaX) > minSwipeDistance && 
          horizontalRatio > minHorizontalRatio && 
          swipeTime < maxSwipeTime &&
          Math.abs(deltaY) < maxVerticalDistance) {
        if (deltaX > 0) {
          instance.proxy.switchTab('prev')
        } else {
          instance.proxy.switchTab('next')
        }
      }
      
      isTouching = false
    }

    return {
      onTouchStart,
      onTouchMove,
      onTouchEnd
    }
  },
  mounted() {
    // 修改触摸事件监听
    const el = this.$el.querySelector('.el-tabs__content')
    
    // 添加下拉刷新相关事件
    el.addEventListener('touchstart', this.onTouchStart)
    el.addEventListener('touchmove', this.onTouchMove)
    el.addEventListener('touchend', this.onTouchEnd)
    
    // 为Tab头部添加滑动事件
    const tabHeader = this.$el.querySelector('.el-tabs__nav-wrap')
    if (tabHeader) {
      tabHeader.addEventListener('touchstart', this.onTabHeaderTouchStart, { passive: false })
      tabHeader.addEventListener('touchmove', this.onTabHeaderTouchMove, { passive: false })
      tabHeader.addEventListener('touchend', this.onTabHeaderTouchEnd)
    }

    // 清理事件监听器
    onBeforeUnmount(() => {
      el.removeEventListener('touchstart', this.onTouchStart)
      el.removeEventListener('touchmove', this.onTouchMove)
      el.removeEventListener('touchend', this.onTouchEnd)
      
      if (tabHeader) {
        tabHeader.removeEventListener('touchstart', this.onTabHeaderTouchStart)
        tabHeader.removeEventListener('touchmove', this.onTabHeaderTouchMove)
        tabHeader.removeEventListener('touchend', this.onTabHeaderTouchEnd)
      }
    })
  }
}
</script>

<style scoped lang="scss">
@use "@/assets/styles/variables.scss" as *;

.home {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.tab-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fixed-tab-header {
  z-index: 100;
  background: white;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.tab-content-wrapper {
  flex: 1;
  overflow-y: auto;
  // padding-top: 10px;
}

.tab-content {
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  margin-top: 16px;
}

.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;

  .token-info {
    font-size: 14px;
    color: #666;
    margin-right: auto;
    font-weight: 500;
    padding: 4px 12px;
    border-radius: 6px;
    background: rgba($primary-color, 0.1);
    color: $primary-color;
  }

  .actions {
    display: flex;
    gap: 12px;

    button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      background: $primary-color;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;

      &:hover {
        background: darken($primary-color, 5%);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba($primary-color, 0.2);
      }

      &:disabled {
        background: #e4e7ed;
        color: #c0c4cc;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
    }
  }
}

.main-tabs {
  margin-top: 0;
  padding: 0px;
  background: white;
  border-radius: 12px;
  // box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin: 16px;
  min-height: calc(100vh - 108px);
  transition: transform 0.3s ease;
  
  :deep(.el-tabs__content) {
    padding-top: 12px;
    padding-left: 8px;
    padding-right: 8px;
  }

  :deep(.el-tabs__header) {
    margin: 0;
    background: #f5f7fa;
    border-radius: 8px;
    padding: 0 16px;
    user-select: none; // 禁止文本选中
    -webkit-user-select: none;
    touch-action: pan-x; // 允许水平滑动
  }

  :deep(.el-tabs__nav-wrap) {
    user-select: none;
    -webkit-user-select: none;
    cursor: grab;
    
    &:active {
      cursor: grabbing;
    }
    
    &::after {
      height: 1px;
      background-color: #e4e7ed;
    }
  }

  :deep(.el-tabs__item) {
    font-size: 14px;
    font-weight: 500;
    padding: 0 20px;
    height: 40px;
    line-height: 40px;
    color: #606266;
    transition: all 0.3s ease;

    &:hover {
      color: #409eff;
    }

    &.is-active {
      color: #409eff;
      font-weight: 600;
    }
  }

  :deep(.el-tabs__active-bar) {
    height: 2px;
    background-color: #409eff;
    border-radius: 1px;
  }
}

.refresh-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;

  .loading-icon {
    font-size: 48px;
    color: $primary-color;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .home {
    padding-top: 6px;
  }

  .top-bar {
    height: 56px;
    padding: 0 16px;

    .token-info {
      font-size: 13px;
      padding: 2px 8px;
    }

    .actions {
      gap: 8px;

      button {
        padding: 6px 12px;
        font-size: 13px;
      }
    }
  }

  .main-tabs {
    margin: 12px;
    padding: 12px;
    
    :deep(.el-tabs__content) {
      padding-top: 8px;
      padding-left: 4px;
      padding-right: 4px;
    }
  }
}

// 添加触摸反馈效果
button, .el-tabs__item {
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  transition: transform 0.1s ease;

  &:active {
    transform: scale(0.96);
  }
}

// 添加动画类
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: all 0.3s ease;
}

// 添加移动端优化
@media (max-width: 480px) {
  .home {
    padding-top: 2px;
  }

  .top-bar {
    height: 48px;
    padding: 0 12px;

    .token-info {
      font-size: 12px;
      padding: 2px 6px;
    }

    .actions {
      gap: 6px;

      button {
        padding: 4px 8px;
        font-size: 12px;
      }
    }
  }

  .main-tabs {
    margin: 8px;
    padding: 8px;
    
    :deep(.el-tabs__content) {
      padding-top: 4px;
      padding-left: 2px;
      padding-right: 2px;
    }
  }
}

.slide-left {
  animation: slideLeft 0.3s ease;
}

.slide-right {
  animation: slideRight 0.3s ease;
}

@keyframes slideLeft {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideRight {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.slide-left {
  animation: slideLeft 0.3s ease;
}

.slide-right {
  animation: slideRight 0.3s ease;
}

@keyframes slideLeft {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideRight {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.fixed-tab-header {
  z-index: 100;
  background: white;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.tab-container {
  overflow: auto;
  height: 100vh;
}

// .tab-content {
  // padding: 16px;
// }
</style>