<template>
  <div class="order-list">
    <div v-for="order in orderHistory" :key="order.orderId" class="order-item">
      <div class="status-line">
        <el-tag :type="getStatusType(order.status)">
          {{ getStatusText(order.status) }}
        </el-tag>
        <el-button
          type="danger"
          size="small"
          @click="handleDelete(order.orderId)"
        >
          删除
        </el-button>
        <div v-if="order.status === 'FAIL' && order.errorMsg" class="error-msg">
          {{ order.errorMsg }}
        </div>
      </div>
      <div class="order-content">
        <div class="account">{{ order.item.uid }}</div>
        <div class="dish">{{ order.item.name }}</div>
        <div class="date">日期：{{ order.dates.join(', ') }}</div>
        <div class="time">创建时间：{{ formatDateTime(order.createTime) }}</div>
        <div v-if="order.selectReason" class="select-reason">
          <label>推荐理由：</label>
          <span>{{ order.selectReason }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessageBox } from 'element-plus'

export default {
  props: {
    orderHistory: {
      type: Array,
      required: true
    }
  },
  watch: {
    orderHistory: {
      handler(newVal) {
        if (newVal.length > 0) {
          this.$nextTick(() => {
            this.$refs.historyTable?.doLayout()
          })
        }
      },
      immediate: true
    }
  },
  methods: {
    formatDateTime(dateString) {
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    },
    getStatusType(status) {
      switch (status) {
        case 'INIT':
          return 'info';
        case 'SUCCESS':
          return 'success';
        case 'FAIL':
          return 'danger';
        case 'EXPIRE':
          return 'warning';
        default:
          return 'info';
      }
    },
    getStatusText(status) {
      switch (status) {
        case 'INIT':
          return '初始化';
        case 'SUCCESS':
          return '成功';
        case 'FAIL':
          return '失败';
        case 'EXPIRE':
          return '已过期';
        default:
          return '未知状态';
      }
    },
    async handleDelete(orderId) {
      try {
        await ElMessageBox.confirm('确定要删除该订单吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        this.$emit('delete-order', orderId)
      } catch (error) {
        // 用户取消时不处理
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use "@/assets/styles/global.scss" as *;

.order-list {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.order-item {
  @extend .el-card;
  padding: 24px;
  margin-bottom: 20px;
  background: white;
}

.status-line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  margin-bottom: 16px;
  justify-content: flex-start;

  @media (max-width: 768px) {
    margin-bottom: 12px;
  }

  > * {
    margin-right: 8px;

    &:last-child {
      margin-right: 0;
    }

    @media (max-width: 768px) {
      margin-right: 4px;
    }
  }
}

.order-content {
  padding-left: 8px;
}

.account {
  font-weight: 500;
  font-size: 14px;
  color: $primary-color;
}

.dish {
  font-size: 14px;
  color: #606266;
  margin: 12px 0;
}

.date, .time {
  font-size: 14px;
  color: $info-color;
  margin-bottom: 8px;
}

.select-reason {
  margin-top: 12px;
  padding: 12px;
  background: #f0f9ff;
  border-left: 3px solid #409eff;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.6;

  label {
    font-weight: 600;
    color: #409eff;
    margin-right: 4px;
  }

  span {
    color: #606266;
  }

  @media (max-width: 768px) {
    margin-top: 8px;
    padding: 10px;
    font-size: 13px;
  }
}

.status {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;

  &-INIT {
    background-color: rgba($info-color, 0.1);
    color: $info-color;
  }

  &-SUCCESS {
    background-color: rgba($success-color, 0.1);
    color: $success-color;
  }

  &-FAIL {
    background-color: rgba($danger-color, 0.1);
    color: $danger-color;
  }

  &-EXPIRE {
    background-color: rgba($warning-color, 0.1);
    color: $warning-color;
  }
}

.error-msg {
  color: #f56c6c;
  font-size: 12px;
  width: 100%;
  margin-top: 4px;
  // padding-left: 40px;
  word-break: break-word;
  text-align: left;

  @media (max-width: 768px) {
    font-size: 11px;
    // padding-left: 32px;
    margin-top: 2px;
  }
}

.el-button {
  margin-left: auto;
}

.history-container {
  text-align: left;
}
</style> 