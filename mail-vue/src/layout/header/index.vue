<template>
  <div class="header" :class="!hasPerm('email:send') ? 'not-send' : ''">
    <div class="header-btn">
      <hanburger @click="changeAside"></hanburger>
      <span class="breadcrumb-item">{{ $t(route.meta.title) }}</span>
    </div>
    <div v-perm="'email:send'" class="writer-box" @click="openSend">
      <div class="writer">
        <Icon icon="material-symbols:edit-outline-sharp" width="20" height="20"/>
      </div>
    </div>
    <div class="toolbar">
      <div v-if="uiStore.dark" class="sun-icon icon-item" @click="openDark($event)">
        <Icon icon="mingcute:sun-fill"/>
      </div>
      <div v-else class="dark-icon icon-item" @click="openDark($event)">
        <Icon icon="solar:moon-linear"/>
      </div>
      <div v-if="settingStore.settings.notice !== 1" class="notice icon-item" @click="openNotice">
        <Icon icon="streamline-plump:announcement-megaphone"/>
      </div>
      <el-dropdown ref="userinfoRef" @visible-change="e => userInfoShow = e" :teleported="false" popper-class="detail-dropdown">
        <div class="avatar" @click="userInfoHide" >
          <div class="avatar-text">
            <div>{{ formatName(userStore.user.email) }}</div>
          </div>
          <Icon class="setting-icon" icon="mingcute:down-small-fill" width="24" height="24"/>
        </div>
        <template #dropdown>
          <div class="user-details">
            <div class="details-avatar">
              {{ formatName(userStore.user.email) }}
            </div>
            <div class="user-name">
              {{ userStore.user.name }}
            </div>
            <div class="detail-email" @click="copyEmail(userStore.user.email)">
              {{ userStore.user.email }}
            </div>
            <div class="detail-user-type">
              <el-tag>{{ userStore.user.role.name }}</el-tag>
            </div>
            <div class="action-info">
              <div>
                <span style="margin-right: 10px">{{ $t('sendCount') }}</span>
                <span style="margin-right: 10px">{{ $t('accountCount') }}</span>
              </div>
              <div>
                <div>
                  <span v-if="sendCount" style="margin-right: 5px">{{ sendCount }}</span>
                  <el-tag v-if="!hasPerm('email:send')">{{ sendType }}</el-tag>
                  <el-tag v-else>{{ sendType }}</el-tag>
                </div>
                <div>
                  <el-tag v-if="settingStore.settings.manyEmail || settingStore.settings.addEmail">
                    {{ $t('disabled') }}
                  </el-tag>
                  <span v-else-if="accountCount && hasPerm('account:add')"
                        style="margin-right: 5px">{{ $t('totalUserAccount', {msg: accountCount}) }}</span>
                  <el-tag v-else-if="!accountCount && hasPerm('account:add')">{{ $t('unlimited') }}</el-tag>
                  <el-tag v-else-if="!hasPerm('account:add')">{{ $t('unauthorized') }}</el-tag>
                </div>
              </div>
            </div>
            <div class="logout">
              <el-button type="primary" :loading="logoutLoading" @click="clickLogout">{{ $t('logOut') }}</el-button>
            </div>
          </div>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import router from "@/router";
import hanburger from '@/components/hamburger/index.vue'
import {logout} from "@/request/login.js";
import {Icon} from "@iconify/vue";
import {useUiStore} from "@/store/ui.js";
import {useUserStore} from "@/store/user.js";
import {useRoute} from "vue-router";
import {computed, ref} from "vue";
import {useSettingStore} from "@/store/setting.js";
import {hasPerm} from "@/perm/perm.js"
import {useI18n} from "vue-i18n";
import {setExtend} from "@/utils/day.js"

const {t} = useI18n();
const route = useRoute();
const settingStore = useSettingStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const logoutLoading = ref(false)
const userInfoShow = ref(false)
const userinfoRef = ref({})

const accountCount = computed(() => {
  return userStore.user.role.accountCount
})

const sendType = computed(() => {

  if (settingStore.settings.send === 1) {
    return t('disabled')
  }

  if (!hasPerm('email:send')) {
    return t('unauthorized')
  }

  if (userStore.user.role.sendType === 'ban') {
    return t('sendBanned')
  }

  if (userStore.user.role.sendType === 'internal') {
    return t('sendInternal')
  }

  if (!userStore.user.role.sendCount) {
    return t('unlimited')
  }

  if (userStore.user.role.sendType === 'day') {
    return t('daily')
  }

  if (userStore.user.role.sendType === 'count') {
    return t('total')
  }
})

const sendCount = computed(() => {


  if (!hasPerm('email:send')) {
    return null
  }

  if (userStore.user.role.sendType === 'ban') {
    return null
  }

  if (userStore.user.role.sendType === 'internal') {
    return null
  }

  if (!userStore.user.role.sendCount) {
    return null
  }

  if (settingStore.settings.send === 1) {
    return null
  }

  return userStore.user.sendCount + '/' + userStore.user.role.sendCount
})

function userInfoHide(e) {
    if (userInfoShow.value) {
        userinfoRef.value.handleClose()
    } else {
        userinfoRef.value.handleOpen()
    }
}

async function copyEmail(email) {
  try {
    await navigator.clipboard.writeText(email);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true,
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true,
    })
  }
}

function changeLang(lang) {
  setExtend(lang === 'en' ? 'en' : 'zh-cn')
  settingStore.lang = lang
}

function openNotice() {
  uiStore.showNotice()
}

function openDark(e) {

  const nextIsDark = !uiStore.dark
  const root = document.documentElement

  if (!document.startViewTransition) {
    switchDark(nextIsDark, root);
    return
  }

  const x = e.clientX
  const y = e.clientY

  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  const endRadius = Math.hypot(maxX, maxY)

  // 标记切换目标，供 CSS 选择器使用
  root.setAttribute('data-theme-to', nextIsDark ? 'dark' : 'light')
  root.style.setProperty('--vt-x', `${x}px`)
  root.style.setProperty('--vt-y', `${y}px`)
  root.style.setProperty('--vt-end-radius', `${endRadius + 10}px`)

  const transition = document.startViewTransition(() => {
    switchDark(nextIsDark, root);
  })

  transition.finished.finally(() => {
    // 清理标记
    root.removeAttribute('data-theme-to')
  })
}

function switchDark(nextIsDark, root) {
  root.setAttribute('class', nextIsDark ? 'dark' : '')
  const metaTag = document.getElementById('theme-color-meta');
  const isMobile =  !window.matchMedia("(pointer: fine) and (hover: hover)").matches;
  metaTag.setAttribute('content', nextIsDark ? (isMobile ? '#141414' : '#000000') : (isMobile ? '#FFFFFF' : '#F1F1F1'));
  uiStore.dark = nextIsDark
}

function openSend() {
  uiStore.writerRef.open()
}

function changeAside() {
  uiStore.asideShow = !uiStore.asideShow
}

function clickLogout() {
  logoutLoading.value = true
  logout().then(() => {
    localStorage.removeItem("token")
    router.replace('/login')
  }).finally(() => {
    logoutLoading.value = false
  })
}

function formatName(email) {
  return email[0]?.toUpperCase() || ''
}

</script>
<style>
.detail-dropdown {
  color: var(--el-text-color-primary) !important;
}
</style>
<style lang="scss" scoped>

:deep(.el-popper.is-pure) {
  border-radius: var(--md-sys-shape-corner-medium);
}

.user-details {
  width: 280px;
  font-size: 14px;
  display: grid;
  grid-template-columns: 1fr;
  justify-items: center;

  .user-name {
    font: var(--md-sys-typescale-title-medium);
    font-weight: 600;
    margin-top: 12px;
    padding-left: 24px;
    padding-right: 24px;
    width: 280px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
  }

  .detail-user-type {
    margin-top: 12px;
  }

  .action-info {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto;
    margin-top: 12px;
    padding: 0 16px;
    font: var(--md-sys-typescale-body-small);

    > div:first-child {
      display: grid;
      align-items: center;
      gap: 10px;
    }

    > div:last-child {
      display: grid;
      gap: 10px;
      text-align: center;

      > div {
        display: flex;
        align-items: center;
      }
    }
  }

  .detail-email {
    padding-left: 24px;
    padding-right: 24px;
    width: 280px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    font: var(--md-sys-typescale-body-small);
    margin-top: 4px;
    border-radius: var(--md-sys-shape-corner-small);
    padding-top: 4px;
    padding-bottom: 4px;
    transition: background var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);

    &:hover {
      background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
    }
  }

  .logout {
    margin-top: 20px;
    width: 100%;
    padding: 0 16px 16px 16px;

    .el-button {
      border-radius: var(--md-sys-shape-corner-full);
      height: 40px;
      width: 100%;
      font: var(--md-sys-typescale-label-large);
    }
  }

  .details-avatar {
    margin-top: 24px;
    height: 48px;
    width: 48px;
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    border: none;
    font-size: 20px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--md-sys-shape-corner-full);
  }
}


.header {
  text-align: right;
  font-size: 14px;
  display: grid;
  height: 100%;
  gap: 12px;
  grid-template-columns: auto auto 1fr;
  padding: 0 8px;
}

.header.not-send {
  grid-template-columns: auto 1fr;
}

.writer-box {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;

  .writer {
    width: 40px;
    height: 40px;
    border-radius: var(--md-sys-shape-corner-medium);
    color: var(--md-sys-color-on-primary-container);
    background: var(--md-sys-color-primary-container);
    box-shadow: var(--md-sys-elevation-3);
    transition: all var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
    display: flex;
    align-items: center;
    justify-content: center;

    .writer-text {
      margin-left: 15px;
      font: var(--md-sys-typescale-label-large);
    }

    &:hover {
      box-shadow: var(--md-sys-elevation-4);
      background: color-mix(in srgb, var(--md-sys-color-on-primary-container) 8%, var(--md-sys-color-primary-container));
    }

    &:active {
      box-shadow: var(--md-sys-elevation-3);
    }
  }
}

.header-btn {
  display: inline-flex;
  align-items: center;
  height: 100%;
  min-width: 0;
}

.breadcrumb-item {
  font: var(--md-sys-typescale-title-medium);
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.toolbar {
  display: flex;
  justify-content: end;
  gap: 4px;
  align-items: center;
  padding-right: 4px;
  @media (max-width: 767px) {
    gap: 0;
  }

  .icon-item {
    align-self: center;
    width: 40px;
    height: 40px;
    border-radius: var(--md-sys-shape-corner-full);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--md-sys-color-on-surface-variant);
    transition: background var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);
  }

  .icon-item:hover {
    background: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 8%, transparent);
  }

  .icon-item:active {
    background: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 12%, transparent);
  }

  .notice {
    font-size: 22px;
  }

  .dark-icon {
    font-size: 20px;
  }

  .sun-icon {
    font-size: 24px;
  }

  .avatar {
    display: flex;
    align-items: center;
    cursor: pointer;
    gap: 2px;
    padding: 4px;
    border-radius: var(--md-sys-shape-corner-full);
    transition: background var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);

    &:hover {
      background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
    }

    .avatar-text {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      height: 32px;
      width: 32px;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: var(--md-sys-shape-corner-full);
      border: none;
      font-weight: 500;
    }

    .setting-icon {
      position: relative;
      top: 0;
      margin-right: 4px;
      bottom: 10px;
      color: var(--md-sys-color-on-surface-variant);
    }
  }

}

.el-tooltip__trigger:first-child:focus-visible {
  outline: unset;
}
</style>
