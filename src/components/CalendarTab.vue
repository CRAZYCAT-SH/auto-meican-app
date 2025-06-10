<template>
  <div class="calendar-tab">
    <div v-for="(weekData, weekIndex) in groupedCalendarData" :key="weekIndex" class="week-container">
      <h3 class="week-title">{{ getWeekTitle(weekIndex) }}</h3>
      <el-table :data="weekData" :border="true" class="calendar-table">
        <el-table-column
          prop="date"
          label="日期"
          :width="isMobile ? '120' : '180'"
          align="center"
        >
          <template #default="{ row }">
            {{ formatFullDate(row.date) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="dish"
          label="菜品"
          align="left"
        >
          <template #default="{ row }">
            <template v-if="row.order">
              <div class="order-info-container">
                <el-tag 
                  size="small" 
                  :type="getStatusType(row.order.status)"
                  class="status-tag"
                >
                  {{ getStatusText(row.order.status) }}
                </el-tag>
                <span class="dish-name">{{ row.order.dish }}</span>
                <el-button
                  v-if="row.order.status === 'CURRENT' || row.order.status === 'INIT'"
                  size="small"
                  type="danger"
                  link
                  @click="handleDeleteOrder(row.order)"
                >
                  删除
                </el-button>
              </div>
            </template>
            <template v-else-if="isDateAvailable(row.date)">
              <div class="button-group">
                <el-button
                  size="small"
                  type="primary"
                  default
                  @click="handleAddOrder(row.date)"
                >
                  点餐
                </el-button>
                <el-button
                  size="small"
                  type="info"
                  default
                  @click="handleLeaveRequest(row.date)"
                >
                  请假
                </el-button>
              </div>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 点餐对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="选择菜品"
      :width="isMobile ? '90%' : '30%'"
      class="dish-dialog"
      append-to-body
    >
      <div class="dish-list">
        <el-radio-group v-model="selectedDish">
          <el-radio
            v-for="dish in availableDishes"
            :key="dish"
            :value="dish"
            :disabled="isBlacklisted(dish)"
          >
            {{ dish }}
          </el-radio>
        </el-radio-group>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmOrder">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
      <!-- 提交订单按钮 -->
      <div v-if="orderData && orderData.length > 0" class="submit-order">
      <el-button
        type="primary"
        size="large"
        @click="handleSubmitOrder"
      >
        批量提交订单 ({{ orderData.length }})
      </el-button>
    </div>
</template>

<script>
import { ElMessage } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import api from '@/api'

export default {
  name: 'CalendarTab',
  emits: ['update:orderData', 'submit-success', 'delete-order'],
  props: {
    orderData: {
      type: Array,
      required: true
    },
    homeData: {
      type: Array,
      required: true
    },
    blacklist: {
      type: Array,
      default: () => []
    },
    orderHistory: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      currentDate: new Date(),
      dialogVisible: false,
      selectedDate: null,
      selectedDish: '',
      availableDishes: [],
      viewType: 'week',
      weekDays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
      isMobile: false
    }
  },
  mounted() {
    this.isMobile = window.innerWidth <= 768
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 768
    })
  },
  beforeUnmount() {
    window.removeEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 768
    })
  },
  computed: {
    groupedCalendarData() {
      const today = new Date()
      const startDate = new Date(today)
      // 调整到本周一
      const dayOfWeek = startDate.getDay()
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      startDate.setDate(startDate.getDate() + diff)

      const weeks = this.viewType === 'week' ? 2 : this.getWeeksInMonth(today)
      const groupedData = []

      for (let week = 0; week < weeks; week++) {
        const weekData = []
        for (let day = 0; day < 7; day++) {
          const date = new Date(startDate)
          date.setDate(date.getDate() + (week * 7) + day)
          weekData.push({
            date,
            order: this.getDayOrders(date)
          })
        }
        groupedData.push(weekData)
      }

      return groupedData
    }
  },
  watch: {
    homeData: {
      immediate: true,
      handler(newVal) {
        this.availableDishes = Array.isArray(newVal) ? newVal : []
      }
    }
  },
  methods: {
    formatFullDate(date) {
      return `${date.getMonth() + 1}月${date.getDate()}日 ${this.weekDays[date.getDay()]}`
    },
    getWeeksInMonth(date) {
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      const firstWeek = Math.floor(firstDay.getDate() / 7)
      const lastWeek = Math.floor(lastDay.getDate() / 7)
      return lastWeek - firstWeek + 1
    },
    getDayOrders(date) {
      // 检查当前订单
      const currentOrder = this.orderData.find(order => 
        order.dates.some(orderDate => this.isSameDay(new Date(orderDate), date))
      );
      
      // 检查历史订单
      const historyOrder = this.orderHistory.find(order => 
        this.isSameDay(new Date(order.dates[0]), date) && order.item.uid === localStorage.getItem('token')
      );
      
      if (historyOrder) {
        return {
          orderId: historyOrder.orderId,
          dish: historyOrder.item.name,
          status: historyOrder.status
        };
      }
      
      if (currentOrder) {
        return {
          dish: currentOrder.item,
          status: 'CURRENT'
        };
      }
      
      return null;
    },
    isSameDay(date1, date2) {
      return date1.getFullYear() === date2.getFullYear() &&
             date1.getMonth() === date2.getMonth() &&
             date1.getDate() === date2.getDate();
    },
    isDateAvailable(date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return date >= today
    },
    handleAddOrder(date) {
      this.selectedDate = date
      this.dialogVisible = true
      this.selectedDish = ''
    },
    formatDate(date) {
      return date.toISOString().split('T')[0]
    },
    isBlacklisted(dish) {
      return this.blacklist.includes(dish)
    },
    confirmOrder() {
      if (!this.selectedDish) {
        ElMessage.warning('请选择菜品')
        return
      }

      const formattedDate = this.formatDate(this.selectedDate)

      let newOrderData = [...this.orderData]
      const existingIndex = newOrderData.findIndex(
        order => order.item === this.selectedDish
      )

      if (existingIndex !== -1) {
        if (!newOrderData[existingIndex].dates.includes(formattedDate)) {
          newOrderData[existingIndex].dates.push(formattedDate)
        }
      } else {
        newOrderData.push({
          item: this.selectedDish,
          dates: [formattedDate]
        })
      }

      this.$emit('update:orderData', newOrderData)
      this.dialogVisible = false
      ElMessage.success('点餐成功')
    },
    async handleSubmitOrder() {
      if (!this.orderData || this.orderData.length === 0) {
        ElMessage.warning('没有可提交的订单')
        return
      }

      try {
        // 转换数据格式，为每个日期生成单独的订单
        const orders = this.orderData.flatMap(order => 
          order.dates.map(date => ({
            orderDish: order.item,
            orderDate: date
          }))
        )

        // 逐个提交订单
        for (const order of orders) {
          try {
            await api.submitOrder(order)
          } catch (error) {
            console.error('提交订单失败:', error)
            ElMessage.error(`提交订单失败：${error.message || '未知错误'}`)
            return
          }
        }

        // 清空本地订单数据
        this.$emit('update:orderData', [])
        // 触发提交成功事件，通知父组件刷新数据
        this.$emit('submit-success')
        ElMessage.success('订单提交成功')
      } catch (error) {
        console.error('提交订单失败:', error)
        ElMessage.error('提交订单失败：' + (error.message || '未知错误'))
      }
    },
    getStatusType(status) {
      switch (status) {
        case 'SUCCESS':
          return 'success';
        case 'FAIL':
          return 'danger';
        case 'EXPIRE':
          return 'warning';
        case 'CURRENT':
          return 'primary';
        default:
          return 'info';
      }
    },
    getStatusText(status) {
      switch (status) {
        case 'INIT':
          return '初始化';
        case 'SUCCESS':
          return '已完成';
        case 'FAIL':
          return '失败';
        case 'EXPIRE':
          return '已过期';
        case 'CURRENT':
          return '待提交';
        default:
          return '未知';
      }
    },
    getWeekTitle(weekIndex) {
      switch (weekIndex) {
        case 0:
          return '本周';
        case 1:
          return '下周';
        case 2:
          return '下下周';
        default:
          return `第 ${weekIndex + 1} 周`;
      }
    },
    handleDeleteOrder(order) {
      // 只有历史订单(有orderId)才显示确认弹窗
      if (order.orderId) {
        ElMessageBox.confirm('确定要删除该订单吗？', '删除订单', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          // 删除历史订单
          this.$emit('delete-order', order.orderId)
          ElMessage.success('订单已删除')
        }).catch(() => {
          ElMessage.info('已取消删除')
        })
      } else {
        // 当前订单直接删除，不显示弹窗
        // 删除当前订单 - 只删除特定日期的特定菜品
        const currentDate = this.formatDate(new Date())
        const updatedOrderData = [...this.orderData]
        
        // 查找包含该菜品的订单
        const orderIndex = updatedOrderData.findIndex(o => o.item === order.dish)
        
        if (orderIndex !== -1) {
          // 如果该菜品订单只有一个日期，则删除整个订单
          if (updatedOrderData[orderIndex].dates.length === 1) {
            updatedOrderData.splice(orderIndex, 1)
          } else {
            // 否则只删除当前日期的订单
            const dateToRemove = this.selectedDate ? this.formatDate(this.selectedDate) : currentDate
            updatedOrderData[orderIndex].dates = updatedOrderData[orderIndex].dates.filter(
              date => date !== dateToRemove
            )
          }
        }
        
        this.$emit('update:orderData', updatedOrderData)
        ElMessage.success('订单已删除')
      }
    },
    handleLeaveRequest(date) {
      const formattedDate = this.formatDate(date)
      
      let newOrderData = [...this.orderData]
      const leaveRequest = {
        item: "请假",
        dates: [formattedDate]
      }
      
      // 检查是否已经有相同日期的请假记录
      const existingIndex = newOrderData.findIndex(
        order => order.item === "请假" && order.dates.includes(formattedDate)
      )
      
      if (existingIndex === -1) {
        // 如果没有相同日期的请假记录，添加新记录
        newOrderData.push(leaveRequest)
        this.$emit('update:orderData', newOrderData)
        ElMessage.success('已添加请假记录')
      } else {
        // 如果已有相同日期的请假记录，提示用户
        ElMessage.info('该日期已有请假记录')
      }
    },
  }
}
</script>

<style scoped lang="scss">
.calendar-tab {
  padding: 20px;
  position: relative;
  contain: content;
}
.dish-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f5f7fa;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c0c4cc;
    border-radius: 3px;
    transition: background-color 0.3s;

    &:hover {
      background: #909399;
    }
  }

  :deep(.el-radio) {
    white-space: normal;
    height: auto;
    padding: 8px;
    margin-right: 0;
    width: 100%;
    box-sizing: border-box;

    .el-radio__label {
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.4;
    }
  }
}

@media (max-width: 768px) {
  .dish-dialog {
    :deep(.el-dialog__body) {
      padding: 16px;
    }

    .el-radio {
      margin-bottom: 12px;
      font-size: 14px;
      padding: 8px;
      border-radius: 4px;
      background-color: #f5f7fa;
      
      &:last-child {
        margin-bottom: 0;
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      
      .el-button {
        flex: 1;
      }
    }
  }
}

.calendar-tab {
  padding: 20px;
  position: relative;
  contain: content;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  height: 100%;
  min-height: calc(100vh - 160px);
  box-sizing: border-box;
  overflow: auto;
  will-change: transform;
}

.week-container {
  flex: 1;
  min-width: 100%;
  contain: content;
  display: flex;
  flex-direction: column;
  position: relative;
  transform: translateZ(0);
}

@media (min-width: 768px) {
  .week-container {
    min-width: 45%;
  }
}

.calendar-table {
  width: 100%;
  font-size: 14px;
}

.order-info-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  contain: content;
  flex-wrap: wrap;
}

.status-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  flex-shrink: 0;
}

.dish-name {
  font-size: 14px;
  flex: 1;
  min-width: 0;
  word-break: break-word;
  line-height: 1.4;
  padding: 2px 0;
}

.submit-order {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 20px;
  background: white;
  border-radius: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 10;
  transition: all 0.3s ease;
}

.submit-order:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .calendar-tab {
    padding: 10px;
    gap: 10px;
  }

  .week-container {
    margin-bottom: 15px;
  }

  .calendar-table {
    font-size: 12px;
  }

  .order-info-container {
    padding: 2px;
    gap: 4px;
    flex-direction: column;
    align-items: flex-start;
  }

  .status-tag {
    font-size: 10px;
    padding: 1px 4px;
    margin-bottom: 4px;
  }

  .dish-name {
    font-size: 12px;
    flex: 1;
    width: 100%;
    margin-bottom: 4px;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }

  :deep(.el-table__cell) {
    padding: 8px !important;
  }

  :deep(.el-button--small) {
    padding: 6px 12px;
    font-size: 12px;
  }
}

.button-group {
  display: flex;
  gap: 8px;
}
</style>