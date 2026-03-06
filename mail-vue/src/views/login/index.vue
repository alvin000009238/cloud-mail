<template>
  <div id="login-box">
    <div id="background-wrap" v-if="!settingStore.settings.background">
      <div class="x1 cloud"></div>
      <div class="x2 cloud"></div>
      <div class="x3 cloud"></div>
      <div class="x4 cloud"></div>
      <div class="x5 cloud"></div>
    </div>
    <div v-else :style="background"></div>
    <div class="form-wrapper">
      <div class="container">
        <span class="form-title">{{ settingStore.settings.title }}</span>
        <span class="form-desc" v-if="show === 'login'">{{ $t('loginTitle') }}</span>
        <span class="form-desc" v-else>{{ $t('regTitle') }}</span>
        <div v-show="show === 'login'">
          <el-input :class="settingStore.settings.loginDomain === 0 ? 'email-input' : ''" v-model="form.email"
                    type="text" :placeholder="$t('emailAccount')" autocomplete="off">
            <template #append v-if="settingStore.settings.loginDomain === 0">
              <div @click.stop="openSelect">
                <el-select
                    v-if="show === 'login'"
                    ref="mySelect"
                    v-model="suffix"
                    :placeholder="$t('select')"
                    class="select"
                >
                  <el-option
                      v-for="item in domainList"
                      :key="item"
                      :label="item"
                      :value="item"
                  />
                </el-select>
                <div style="color: var(--el-text-color-primary)">
                  <span>{{ suffix }}</span>
                  <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
                </div>
              </div>
            </template>
          </el-input>
          <el-input v-model="form.password" :placeholder="$t('password')" type="password" autocomplete="off">
          </el-input>
          <el-button class="btn" type="primary" @click="submit" :loading="loginLoading" :disabled="oauthProcessing"
          >{{ $t('loginBtn') }}
          </el-button>
          <div v-if="oauthProviders.length" class="oauth-container">
            <div class="oauth-divider">
              <span>{{ $t('oauthLogin') }}</span>
            </div>
            <el-button
                v-for="provider in oauthProviders"
                :key="provider.provider"
                class="oauth-btn"
                type="default"
                :loading="oauthLoadingProvider === provider.provider"
                :disabled="oauthProcessing"
                @click="startOAuth(provider.provider)"
            >
              <Icon :icon="providerIcon(provider.provider)" width="20" height="20" class="oauth-icon"/>
              <span>{{ provider.name }}</span>
            </el-button>
          </div>
          <div v-if="passkeySupported" class="passkey-container">
            <div v-if="!oauthProviders.length" class="oauth-divider">
              <span>{{ $t('orUsePasskey') }}</span>
            </div>
            <el-button
                class="passkey-btn"
                type="default"
                :loading="passkeyLoading"
                :disabled="oauthProcessing"
                @click="passkeyLogin"
            >
              <Icon icon="mdi:key-variant" width="20" height="20" class="oauth-icon"/>
              <span>{{ $t('passkeyLoginBtn') }}</span>
            </el-button>
          </div>
          <el-alert
              v-if="oauthProcessing"
              class="oauth-alert"
              type="info"
              :title="$t('oauthProcessing')"
              show-icon
          />
        </div>
        <div v-show="show !== 'login'">
          <el-input class="email-input" v-model="registerForm.email" type="text" :placeholder="$t('emailAccount')"
                    autocomplete="off">
            <template #append>
              <div @click.stop="openSelect">
                <el-select
                    v-if="show !== 'login'"
                    ref="mySelect"
                    v-model="suffix"
                    :placeholder="$t('select')"
                    class="select"
                >
                  <el-option
                      v-for="item in domainList"
                      :key="item"
                      :label="item"
                      :value="item"
                  />
                </el-select>
                <div>
                  <span>{{ suffix }}</span>
                  <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
                </div>
              </div>
            </template>
          </el-input>
          <el-input v-model="registerForm.password" :placeholder="$t('password')" type="password" autocomplete="off"/>
          <el-input v-model="registerForm.confirmPassword" :placeholder="$t('confirmPwd')" type="password"
                    autocomplete="off"/>
          <el-input v-if="settingStore.settings.regKey === 0" v-model="registerForm.code" :placeholder="$t('regKey')"
                    type="text" autocomplete="off"/>
          <el-input v-if="settingStore.settings.regKey === 2" v-model="registerForm.code"
                    :placeholder="$t('regKeyOptional')" type="text" autocomplete="off"/>
          <div v-show="verifyShow"
               class="register-turnstile"
               :data-sitekey="settingStore.settings.siteKey"
               data-callback="onTurnstileSuccess"
               data-error-callback="onTurnstileError"
               data-after-interactive-callback="loadAfter"
               data-before-interactive-callback="loadBefore"
          >
            <span style="font-size: 12px;color: #F56C6C" v-if="botJsError">{{ $t('verifyModuleFailed') }}</span>
          </div>
          <el-button class="btn" type="primary" @click="submitRegister" :loading="registerLoading"
          >{{ $t('regBtn') }}
          </el-button>
        </div>
        <template v-if="settingStore.settings.register === 0">
          <div class="switch" @click="show = 'register'" v-if="show === 'login'">{{ $t('noAccount') }}
            <span>{{ $t('regSwitch') }}</span></div>
          <div class="switch" @click="show = 'login'" v-else>{{ $t('hasAccount') }} <span>{{ $t('loginSwitch') }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import router from "@/router";
import {computed, nextTick, reactive, ref, onMounted, watch} from "vue";
import {login, register, oauthAuthorize} from "@/request/login.js";
import {passkeyLoginOptions, passkeyLoginVerify} from "@/request/passkey.js";
import {isEmail} from "@/utils/verify-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {useUserStore} from "@/store/user.js";
import {useUiStore} from "@/store/ui.js";
import {Icon} from "@iconify/vue";
import {cvtR2Url} from "@/utils/convert.js";
import {loginUserInfo} from "@/request/my.js";
import {permsToRouter} from "@/perm/perm.js";
import {useI18n} from "vue-i18n";
import {useRoute} from "vue-router";

const {t} = useI18n();
const accountStore = useAccountStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const settingStore = useSettingStore();
const route = useRoute();
const loginLoading = ref(false)
const show = ref('login')
const form = reactive({
  email: '',
  password: '',

});
const mySelect = ref()
const suffix = ref('')
const registerForm = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  code: null
})
const domainList = settingStore.domainList;
const registerLoading = ref(false)
suffix.value = domainList[0]
const verifyShow = ref(false)
let verifyToken = ''
let turnstileId = null
let botJsError = ref(false)
let verifyErrorCount = 0
const oauthProviders = computed(() => settingStore.settings.oauthProviders || [])
const oauthLoadingProvider = ref('')
const oauthProcessing = ref(false)
let processedOAuthState = null
const passkeySupported = ref(false)
const passkeyLoading = ref(false)

if (window.PublicKeyCredential) {
  passkeySupported.value = true
}

const providerIcon = (provider) => {
  if (provider === 'github') {
    return 'mdi:github';
  }
  return 'carbon:user-avatar';
}

const startOAuth = async (provider) => {
  if (oauthLoadingProvider.value || oauthProcessing.value) {
    return
  }
  oauthLoadingProvider.value = provider
  try {
    const { url } = await oauthAuthorize(provider)
    sessionStorage.setItem('oauth_provider', provider)
    window.location.href = url
  } finally {
    oauthLoadingProvider.value = ''
  }
}

const completeLogin = async (token) => {
  localStorage.setItem('token', token)
  const user = await loginUserInfo();
  accountStore.currentAccountId = user.account.accountId;
  userStore.user = user;
  const routers = permsToRouter(user.permKeys);
  routers.forEach(routerData => {
    router.addRoute('layout', routerData);
  });
  await router.replace({name: 'layout'})
  uiStore.showNotice()
}

const handleOAuthCallback = () => {
  const query = route.query;
  const code = Array.isArray(query.code) ? query.code[0] : query.code;
  const state = Array.isArray(query.state) ? query.state[0] : query.state;

  if (!code || !state) {
    return
  }

  if (processedOAuthState === state) {
    return
  }

  const storedProvider = sessionStorage.getItem('oauth_provider');
  const queryProvider = Array.isArray(query.provider) ? query.provider[0] : query.provider;
  const provider = queryProvider || storedProvider || (oauthProviders.value.length === 1 ? oauthProviders.value[0].provider : null);

  if (!provider) {
    return
  }

  processedOAuthState = state
  oauthProcessing.value = true
  router.replace({ name: 'oauth-callback', params: { provider }, query: { code, state } })
}

onMounted(() => {
  handleOAuthCallback()
})

const passkeyLogin = async () => {
  if (passkeyLoading.value || oauthProcessing.value) return
  passkeyLoading.value = true
  try {
    const options = await passkeyLoginOptions()
    const publicKeyOptions = {
      challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
      timeout: options.timeout,
      rpId: options.rpId,
      userVerification: options.userVerification,
      allowCredentials: options.allowCredentials || []
    }
    const credential = await navigator.credentials.get({ publicKey: publicKeyOptions })
    const credentialData = {
      id: credential.id,
      type: credential.type,
      response: {
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        authenticatorData: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        userHandle: credential.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(credential.response.userHandle))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') : null
      }
    }
    const data = await passkeyLoginVerify(credentialData)
    await completeLogin(data.token)
  } catch (e) {
    if (e?.name !== 'NotAllowedError') {
      ElMessage({ message: e?.message || t('passkeyLoginFailed'), type: 'error', plain: true })
    }
  } finally {
    passkeyLoading.value = false
  }
}

watch(oauthProviders, (providers) => {
  if (providers.length) {
    handleOAuthCallback()
  }
})

window.onTurnstileSuccess = (token) => {
  verifyToken = token;
};

window.onTurnstileError = (e) => {
  if (verifyErrorCount >= 4) {
    return
  }
  verifyErrorCount++
  console.warn('人机验加载失败', e)
  setTimeout(() => {
    nextTick(() => {
      if (!turnstileId) {
        turnstileId = window.turnstile.render('.register-turnstile')
      } else {
        window.turnstile.reset(turnstileId);
      }
    })
  }, 1500)
};

window.loadAfter = (e) => {
  console.log('loadAfter')
}

window.loadBefore = (e) => {
  console.log('loadBefore')
}

const loginOpacity = computed(() => {
  const opacity = settingStore.settings.loginOpacity
  return uiStore.dark ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`
})

const background = computed(() => {

  return settingStore.settings.background ? {
    'background-image': `url(${cvtR2Url(settingStore.settings.background)})`,
    'background-repeat': 'no-repeat',
    'background-size': 'cover',
    'background-position': 'center'
  } : ''
})


const openSelect = () => {
  mySelect.value.toggleMenu()
}

const submit = () => {

  if (oauthProcessing.value) {
    return
  }

  if (!form.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  let email = form.email + (settingStore.settings.loginDomain === 0 ? suffix.value : '');

  if (!isEmail(email)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!form.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  loginLoading.value = true
  login(email, form.password).then(async data => {
    await completeLogin(data.token)
  }).finally(() => {
    loginLoading.value = false
  })
}


function submitRegister() {

  if (!registerForm.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!isEmail(registerForm.email + suffix.value)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!registerForm.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (registerForm.password.length < 6) {
    ElMessage({
      message: t('pwdLengthMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (registerForm.password !== registerForm.confirmPassword) {

    ElMessage({
      message: t('confirmPwdFailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (settingStore.settings.regKey === 0) {

    if (!registerForm.code) {

      ElMessage({
        message: t('emptyRegKeyMsg'),
        type: 'error',
        plain: true,
      })
      return
    }

  }

  if (!verifyToken && (settingStore.settings.registerVerify === 0 || (settingStore.settings.registerVerify === 2 && settingStore.settings.regVerifyOpen))) {
    if (!verifyShow.value) {
      verifyShow.value = true
      nextTick(() => {
        if (!turnstileId) {
          try {
            turnstileId = window.turnstile.render('.register-turnstile')
          } catch (e) {
            botJsError.value = true
            console.log('人机验证js加载失败')
          }
        } else {
          window.turnstile.reset('.register-turnstile')
        }
      })
    } else if (!botJsError.value) {
      ElMessage({
        message: t('botVerifyMsg'),
        type: "error",
        plain: true
      })
    }
    return;
  }

  registerLoading.value = true

  const form = {
    email: registerForm.email + suffix.value,
    password: registerForm.password,
    token: verifyToken,
    code: registerForm.code
  }

  register(form).then(({regVerifyOpen}) => {
    show.value = 'login'
    registerForm.email = ''
    registerForm.password = ''
    registerForm.confirmPassword = ''
    registerForm.code = ''
    registerLoading.value = false
    verifyToken = ''
    settingStore.settings.regVerifyOpen = regVerifyOpen
    verifyShow.value = false
    ElMessage({
      message: t('regSuccessMsg'),
      type: 'success',
      plain: true,
    })
  }).catch(res => {

    registerLoading.value = false

    if (res.code === 400) {
      verifyToken = ''
      settingStore.settings.regVerifyOpen = true
      if (turnstileId) {
        window.turnstile.reset(turnstileId)
      } else {
        nextTick(() => {
          turnstileId = window.turnstile.render('.register-turnstile')
        })
      }
      verifyShow.value = true

    }
  });
}

</script>


<style>
.el-select-dropdown__item {
  padding: 0 15px;
}

.no-autofill-pwd {
  .el-input__inner {
    -webkit-text-security: disc !important;
  }
}
</style>

<style lang="scss" scoped>

.form-wrapper {
  position: fixed;
  right: 0;
  height: 100%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  @media (max-width: 767px) {
    width: 100%;
  }
}

.container {
  background: v-bind(loginOpacity);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding-left: 40px;
  padding-right: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 450px;
  height: 100%;
  border-left: none;
  box-shadow: var(--md-sys-elevation-2);
  @media (max-width: 1024px) {
    padding: 24px 20px;
    width: 400px;
    margin-left: 18px;
  }
  @media (max-width: 767px) {
    border: none;
    padding: 32px 24px;
    border-radius: var(--md-sys-shape-corner-extra-large);
    height: fit-content;
    width: 100%;
    margin-right: 18px;
    margin-left: 18px;
    box-shadow: var(--md-sys-elevation-3);
  }

  .btn {
    height: 40px;
    width: 100%;
    border-radius: var(--md-sys-shape-corner-full);
    font: var(--md-sys-typescale-label-large);
    margin-top: 4px;
  }

  .form-desc {
    margin-top: 8px;
    margin-bottom: 20px;
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-body-medium);
  }

  .form-title {
    font: var(--md-sys-typescale-headline-medium);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .switch {
    margin-top: 24px;
    text-align: center;
    font: var(--md-sys-typescale-body-medium);
    color: var(--md-sys-color-on-surface-variant);

    span {
      color: var(--md-sys-color-primary);
      cursor: pointer;
      font-weight: 500;
    }
  }

  .oauth-container {
    margin-top: 20px;
  }

  .oauth-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-label-medium);
    margin-bottom: 16px;

    span {
      padding: 0 12px;
    }

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background-color: var(--md-sys-color-outline-variant);
    }

    &::before {
      margin-right: 0;
    }

    &::after {
      margin-left: 0;
    }
  }

  .oauth-btn {
    width: 100%;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    border-radius: var(--md-sys-shape-corner-full) !important;
    border: 1px solid var(--md-sys-color-outline) !important;
    font: var(--md-sys-typescale-label-large);
  }

  .oauth-icon {
    display: inline-flex;
  }

  .oauth-alert {
    margin-top: 16px;
    border-radius: var(--md-sys-shape-corner-medium);
  }

  .passkey-container {
    margin-top: 16px;
  }

  .passkey-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    border-radius: var(--md-sys-shape-corner-full) !important;
    border: 1px solid var(--md-sys-color-outline) !important;
    font: var(--md-sys-typescale-label-large);
  }

  :deep(.el-input__wrapper) {
    border-radius: var(--md-sys-shape-corner-extra-small);
    background: transparent;
  }

  .email-input :deep(.el-input__wrapper) {
    border-radius: var(--md-sys-shape-corner-extra-small) 0 0 var(--md-sys-shape-corner-extra-small);
    background: transparent;
  }

  .el-input {
    height: 48px;
    width: 100%;
    margin-bottom: 16px;

    :deep(.el-input__inner) {
      height: 46px;
    }
  }
}

:deep(.el-select-dropdown__item) {
  padding: 0 10px;
}

.setting-icon {
  position: relative;
  top: 6px;
}

:deep(.el-input-group__append) {
  padding: 0 !important;
  padding-left: 8px !important;
  padding-right: 4px !important;
  background: var(--el-bg-color);
  border-radius: 0 8px 8px 0;
}

.register-turnstile {
  margin-bottom: 18px;
}

.select {
  position: absolute;
  right: 30px;
  width: 100px;
  opacity: 0;
  pointer-events: none;
}

.custom-style {
  margin-bottom: 10px;
}

.custom-style .el-segmented {
  --el-border-radius-base: 6px;
  width: 180px;
}


#login-box {
  background: linear-gradient(135deg, #1565c0 0%, #42a5f5 30%, #90caf9 60%, #e3f2fd 100%);
  font: 100% Arial, sans-serif;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  display: grid;
  grid-template-columns: 1fr;
}


#background-wrap {
  height: 100%;
  z-index: 0;
}

@keyframes animateCloud {
  0% {
    margin-left: -500px;
  }

  100% {
    margin-left: 100%;
  }
}

.x1 {
  animation: animateCloud 30s linear infinite;
  transform: scale(0.65);
}

.x2 {
  animation: animateCloud 15s linear infinite;
  transform: scale(0.3);
}

.x3 {
  animation: animateCloud 25s linear infinite;
  transform: scale(0.5);
}

.x4 {
  animation: animateCloud 13s linear infinite;
  transform: scale(0.4);
}

.x5 {
  animation: animateCloud 20s linear infinite;
  transform: scale(0.55);
}

.cloud {
  background: linear-gradient(to bottom, #fff 5%, #f1f1f1 100%);
  border-radius: 100px;
  box-shadow: 0 8px 5px rgba(0, 0, 0, 0.1);
  height: 120px;
  width: 350px;
  position: relative;
}

.cloud:after,
.cloud:before {
  content: "";
  position: absolute;
  background: #fff;
  z-index: -1;
}

.cloud:after {
  border-radius: 100px;
  height: 100px;
  left: 50px;
  top: -50px;
  width: 100px;
}

.cloud:before {
  border-radius: 200px;
  height: 180px;
  width: 180px;
  right: 50px;
  top: -90px;
}

</style>
