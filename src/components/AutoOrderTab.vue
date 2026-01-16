<template>
  <div class="auto-order-tab">
    <!-- 偏好设置（合并黑名单） -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>AI点餐设置</span>
          <span class="expire-date">
            有效期至：
            <el-date-picker
              v-model="localExpireDate"
              type="date"
              placeholder="选择日期"
              :disabled-date="disabledDate"
              @change="markAsChanged"
            />
          </span>
        </div>
      </template>

      <div class="preferences-section">
        <div class="preference-item">
          <label>喜好(如:辣、糖醋、鸡肉等):</label>
          <el-input
            v-model="localLikes"
            type="textarea"
            :rows="3"
            placeholder="请输入你的口味偏好,例如:喜欢辣的菜品、喜欢鸡肉类菜品"
            @input="markAsChanged"
          />
        </div>

        <div class="preference-item">
          <label>禁忌(如:花生、海鲜等):</label>
          <el-input
            v-model="localRestrictions"
            type="textarea"
            :rows="3"
            placeholder="请输入你的饮食禁忌,例如:对花生过敏、不吃海鲜"
            @input="markAsChanged"
          />
        </div>

        <!-- 黑名单菜品 -->
        <div class="preference-item">
          <label>黑名单菜品:</label>
          
          <!-- 添加新菜品 -->
          <div class="add-dish-section">
            <el-select
              v-model="newItem"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入菜品"
              :loading="!availableDishes"
            >
              <el-option
                v-for="dish in displayDishes"
                :key="getDishKey(dish)"
                :label="getDishLabel(dish)"
                :value="getDishValue(dish)"
              />
            </el-select>
            <el-button 
              type="primary" 
              @click="handleAdd"
              style="margin-left: 10px"
            >
              添加
            </el-button>
          </div>

          <!-- 黑名单列表 -->
          <div class="tags-container">
            <el-tag
              v-for="item in localBlacklist"
              :key="item"
              closable
              @close="handleRemove(item)"
              :title="item"
            >
              {{ item }}
            </el-tag>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 提交按钮 -->
    <div v-if="hasChanges" class="submit-section">
      <el-button type="primary" size="large" @click="handleSubmit" :loading="isSubmitting">
        保存修改
      </el-button>
      <el-button size="large" @click="handleCancel">
        取消
      </el-button>
    </div>

    <!-- AI推荐按钮 -->
    <div v-if="canUseRecommend" class="test-section">
      <el-button type="success" size="large" @click="handleTestRecommend" :loading="isTesting">
        AI智能推荐
      </el-button>
    </div>

    <!-- 推荐结果弹窗 -->
    <el-dialog
      v-model="recommendDialogVisible"
      title="推荐菜品"
      width="90%"
      :style="{ maxWidth: '500px' }"
    >
      <div v-if="recommendResult" class="recommend-content">
        <div class="recommend-item">
          <label>推荐菜品：</label>
          <span class="dish-name">{{ recommendResult.dishName }}</span>
        </div>
        <div class="recommend-item">
          <label>推荐理由：</label>
          <p class="select-reason">{{ recommendResult.selectReason }}</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="recommendDialogVisible = false">关闭</el-button>
        <el-button 
          v-if="recommendResult && recommendResult.dishName"
          type="primary" 
          @click="handleOrderRecommendDish"
        >
          立即点餐
        </el-button>
      </template>
    </el-dialog>

    <!-- 下单日期选择弹窗 -->
    <el-dialog
      v-model="orderDateDialogVisible"
      title="选择下单日期"
      width="90%"
      :style="{ maxWidth: '500px' }"
    >
      <div class="date-selection-container">
        <div 
          v-for="(date, index) in availableOrderDates"
          :key="index"
          class="date-item"
          :class="{ selected: selectedOrderDate === date }"
          @click="selectedOrderDate = date"
        >
          {{ formatOrderDate(date) }}
        </div>
      </div>
      <template #footer>
        <el-button @click="orderDateDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleConfirmOrder"
          :disabled="!selectedOrderDate"
          :loading="isOrdering"
        >
          确认下单
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import api from '@/api'

export default {
  props: {
    blacklist: {
      type: Array,
      required: true
    },
    expireDate: {
      type: [String, null],
      default: null
    },
    availableDishes: {
      type: Array,
      required: true
    },
    likes: {
      type: String,
      default: ''
    },
    restrictions: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      newItem: '',
      localExpireDate: this.expireDate,
      localLikes: this.likes,
      localRestrictions: this.restrictions,
      localBlacklist: [...this.blacklist],
      hasChanges: false,
      isSubmitting: false,
      isTesting: false,
      recommendDialogVisible: false,
      recommendResult: null,
      recommendHistory: [], // 推荐历史记录
      orderDateDialogVisible: false, // 下单日期弹窗
      selectedOrderDate: null, // 选中的下单日期
      isOrdering: false // 下单中
    }
  },
  watch: {
    expireDate(newVal) {
      this.localExpireDate = newVal
    },
    likes(newVal) {
      this.localLikes = newVal
    },
    restrictions(newVal) {
      this.localRestrictions = newVal
    },
    blacklist(newVal) {
      this.localBlacklist = [...newVal]
    }
  },
  methods: {
    // 获取菜品的key
    getDishKey(dish) {
      if (typeof dish === 'object' && dish.id) {
        return dish.id
      }
      return dish
    },
    // 获取菜品的显示标签（包含餐厅名称）
    getDishLabel(dish) {
      if (typeof dish === 'object' && dish.name) {
        const restaurantName = dish.restaurant?.name || '未知餐厅'
        return `${dish.name} - ${restaurantName}`
      }
      return dish
    },
    // 获取菜品的值（只返回菜品名称）
    getDishValue(dish) {
      if (typeof dish === 'object' && dish.name) {
        return dish.name
      }
      return dish
    },
    markAsChanged() {
      this.hasChanges = true
    },
    handleAdd() {
      if (this.newItem.trim()) {
        if (!this.localBlacklist.includes(this.newItem.trim())) {
          this.localBlacklist.push(this.newItem.trim())
          this.newItem = ''
          this.markAsChanged()
        } else {
          this.$message.warning('该菜品已在黑名单中')
        }
      } else {
        this.$message.warning('请选择或输入菜品')
      }
    },
    handleRemove(item) {
      this.localBlacklist = this.localBlacklist.filter(i => i !== item)
      this.markAsChanged()
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      const localDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
      return localDate.toLocaleDateString();
    },
    disabledDate(time) {
      // 禁用今天之前的日期
      return time.getTime() < Date.now() - 8.64e7
    },
    async handleSubmit() {
      try {
        this.isSubmitting = true
        
        // 格式化日期
        let formattedDate = this.expireDate
        if (this.localExpireDate) {
          const date = new Date(this.localExpireDate)
          formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
            .toISOString()
            .split('T')[0]
        }
        
        // 统一提交所有字段
        await this.$emit('submit-all-changes', {
          expireDate: formattedDate,
          likes: this.localLikes,
          restrictions: this.localRestrictions,
          noOrderDishes: this.localBlacklist
        })
        
        this.hasChanges = false
      } catch (error) {
        this.$message.error('保存失败：' + error.message)
      } finally {
        this.isSubmitting = false
      }
    },
    handleCancel() {
      // 重置为原始值
      this.localExpireDate = this.expireDate
      this.localLikes = this.likes
      this.localRestrictions = this.restrictions
      this.localBlacklist = [...this.blacklist]
      this.hasChanges = false
      this.$message.info('已取消修改')
    },
    async handleTestRecommend() {
      try {
        this.isTesting = true
        const token = localStorage.getItem('token')
        
        // 获取今天的日期
        const today = new Date()
        const orderDate = today.toISOString().split('T')[0]
        
        // 将历史推荐用逗号连接
        const recentRecommend = this.recommendHistory.join(',')
        
        const result = await api.recommendDish(token, orderDate, recentRecommend)
        this.recommendResult = result
        
        // 将新的推荐结果添加到历史记录
        if (result && result.dishName) {
          this.recommendHistory.push(result.dishName)
          
          // 限制最多保存5条记录,超过则删除最早的
          if (this.recommendHistory.length > 5) {
            this.recommendHistory.shift() // 删除数组第一个元素(最早的记录)
          }
        }
        
        this.recommendDialogVisible = true
      } catch (error) {
        this.$message.error('获取推荐失败：' + error.message)
      } finally {
        this.isTesting = false
      }
    },
    handleOrderRecommendDish() {
      if (!this.recommendResult || !this.recommendResult.dishName) {
        this.$message.warning('没有推荐菜品')
        return
      }
      // 关闭推荐弹窗,打开日期选择弹窗
      this.recommendDialogVisible = false
      this.selectedOrderDate = null
      this.orderDateDialogVisible = true
    },
    formatOrderDate(date) {
      const d = new Date(date)
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      const weekday = weekdays[d.getDay()]
      return `${month}-${day} 周${weekday}`
    },
    async handleConfirmOrder() {
      if (!this.selectedOrderDate) {
        this.$message.warning('请选择下单日期')
        return
      }
      
      try {
        this.isOrdering = true
        const formattedDate = this.formatSubmitDate(this.selectedOrderDate)
        
        const orderData = {
          orderDish: this.recommendResult.dishName,
          orderDate: formattedDate
        }
        
        // 如果有推荐理由,则添加到订单数据中
        if (this.recommendResult.selectReason) {
          orderData.selectReason = this.recommendResult.selectReason
        }
        
        await api.submitOrder(orderData)
        
        this.$message.success('下单成功')
        this.orderDateDialogVisible = false
        this.selectedOrderDate = null
        
        // 触发提交成功事件,通知父组件刷新数据
        this.$emit('order-success')
      } catch (error) {
        this.$message.error('下单失败：' + error.message)
      } finally {
        this.isOrdering = false
      }
    },
    formatSubmitDate(date) {
      const d = new Date(date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  },
  computed: {
    availableOrderDates() {
      const dates = []
      const today = new Date()
      for (let i = 0; i < 14; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        dates.push(date)
      }
      return dates
    },
    canUseRecommend() {
      // 1. 检查是否有未保存的修改
      if (this.hasChanges) {
        return false
      }
      
      // 2. 检查是否设置了有效期
      if (!this.expireDate) {
        return false
      }
      
      // 3. 检查有效期是否已过期
      const currentDate = new Date()
      const expireDateTime = new Date(this.expireDate)
      if (expireDateTime < currentDate) {
        return false
      }
      
      return true
    },
    // 处理显示的菜品列表，兼容新旧格式
    displayDishes() {
      if (!this.availableDishes || this.availableDishes.length === 0) {
        return []
      }
      
      // 检查是新格式(对象数组)还是旧格式(字符串数组)
      const firstItem = this.availableDishes[0]
      if (typeof firstItem === 'object' && firstItem.name) {
        // 新格式：有餐厅信息的菜品对象
        return this.availableDishes
      } else {
        // 旧格式：字符串数组
        return this.availableDishes
      }
    }
  }
}
</script>

<style scoped lang="scss">
.auto-order-tab {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.expire-date {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preferences-section {
  .preference-item {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      color: #303133;
      font-weight: 500;
    }

    .el-textarea {
      width: 100%;
    }

    .add-dish-section {
      margin-bottom: 12px;
      display: flex;
      align-items: center;

      .el-select {
        flex: 1;
        margin-right: 12px;
      }
    }
  }
}

.tags-container {
  padding-right: 8px;
  min-height: 40px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.el-tag {
  margin: 0;
  padding: 0 28px 0 12px;
  height: auto;
  min-height: 32px;
  line-height: 32px;
  font-size: 14px;
  border-radius: 16px;
  position: relative;
  transition: all 0.3s ease;
  max-width: 100%;
  white-space: normal;
  word-break: break-word;
  display: inline-flex;
  align-items: center;

  // 强制显示关闭按钮
  ::v-deep .el-icon-close {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    width: 16px;
    height: 16px;
    line-height: 16px;
    color: #fff !important;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 50%;
    transition: all 0.2s ease;
    flex-shrink: 0;
    
    &:hover {
      background-color: rgba(0, 0, 0, 0.3);
      transform: translateY(-50%) scale(1.1);
    }
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

// 移动端优化
@media (max-width: 768px) {
  .preferences-section {
    .preference-item {
      label {
        font-size: 13px;
      }

      .add-dish-section {
        flex-direction: column;
        gap: 12px;

        .el-select {
          width: 100%;
          margin-right: 0;
        }

        .el-button {
          width: 100%;
        }
      }
    }
  }

  .el-tag {
    padding: 0 24px 0 10px;
    min-height: 28px;
    line-height: 28px;
    font-size: 13px;

    ::v-deep .el-icon-close {
      right: 2px;
      font-size: 12px;
      width: 14px;
      height: 14px;
      line-height: 14px;
    }
  }

  .tags-container {
    gap: 6px;
  }
}

// 小屏手机优化
@media (max-width: 480px) {
  .preferences-section {
    .preference-item {
      label {
        font-size: 12px;
      }

      .add-dish-section {
        gap: 8px;
      }
    }
  }

  .el-tag {
    padding: 0 20px 0 8px;
    min-height: 24px;
    line-height: 24px;
    font-size: 12px;

    ::v-deep .el-icon-close {
      right: 1px;
      font-size: 10px;
      width: 12px;
      height: 12px;
      line-height: 12px;
    }
  }

  .tags-container {
    gap: 4px;
  }
}

:deep(.el-date-editor) {
  width: 160px;
}

.submit-section {
  margin-top: 24px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  gap: 12px;
  position: sticky;
  bottom: 0;
  z-index: 10;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.1);

  .el-button {
    min-width: 120px;
  }
}

.test-section {
  margin-top: 16px;
  padding: 16px;
  display: flex;
  justify-content: center;

  .el-button {
    min-width: 160px;
  }
}

.recommend-content {
  .recommend-item {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: inline-block;
      font-weight: 600;
      color: #303133;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .dish-name {
      font-size: 18px;
      color: #409eff;
      font-weight: 600;
      margin-left: 8px;
    }

    .select-reason {
      margin: 8px 0 0 0;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 6px;
      line-height: 1.6;
      color: #606266;
      font-size: 14px;
    }
  }
}

.date-selection-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  padding: 12px 0;

  .date-item {
    padding: 16px 12px;
    text-align: center;
    border: 2px solid #dcdfe6;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
    color: #606266;
    background: #fff;

    &:hover {
      border-color: #409eff;
      background: #f0f9ff;
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
    }

    &.selected {
      border-color: #409eff;
      background: #409eff;
      color: #fff;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
    }
  }
}

@media (max-width: 768px) {
  .submit-section {
    padding: 16px;
    gap: 8px;

    .el-button {
      flex: 1;
      min-width: auto;
    }
  }

  .test-section {
    padding: 12px;

    .el-button {
      width: 100%;
      min-width: auto;
    }
  }

  .date-selection-container {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;

    .date-item {
      padding: 14px 10px;
      font-size: 13px;
    }
  }
}
</style> 