<template>
  <div class="box">
    <div class="container">
      <div class="title">{{$t('profile')}}</div>
      <div class="item">
        <div>{{$t('username')}}</div>
        <div>
          <span v-if="setNameShow" class="edit-name-input">
            <el-input v-model="accountName"  ></el-input>
            <span class="edit-name" @click="setName">
             {{$t('save')}}
            </span>
          </span>
          <span v-else class="user-name">
            <span >{{ userStore.user.name }}</span>
            <span class="edit-name" @click="showSetName">
             {{$t('change')}}
            </span>
          </span>
        </div>
      </div>
      <div class="item">
        <div>{{$t('emailAccount')}}</div>
        <div>{{ userStore.user.email }}</div>
      </div>
      <div class="item">
        <div>{{$t('password')}}</div>
        <div>
          <el-button type="primary" @click="pwdShow = true">{{$t('changePwdBtn')}}</el-button>
        </div>
      </div>
      <div class="item">
        <div>{{$t('githubAccount')}}</div>
        <div class="oauth-bind">
          <template v-if="githubBinding">
            <div class="oauth-info">
              <span class="oauth-name">{{ githubBinding.username || githubBinding.name || githubBinding.email }}</span>
              <span v-if="githubBinding.email" class="oauth-sub">{{ githubBinding.email }}</span>
            </div>
            <el-button size="small" :loading="unbindLoading" @click="unbindGitHub">{{$t('unbind')}}</el-button>
          </template>
          <template v-else>
            <span>{{ $t('githubUnbound') }}</span>
            <el-button size="small" type="primary" :loading="bindLoading" @click="bindGitHub">{{$t('bind')}}</el-button>
          </template>
        </div>
      </div>
      <div class="item" v-if="passkeySupported">
        <div>Passkey</div>
        <div class="passkey-manage">
          <div v-for="pk in passkeyListData" :key="pk.id" class="passkey-item">
            <div class="passkey-info">
              <Icon icon="mdi:key-variant" width="16" height="16" />
              <span class="passkey-name">{{ pk.name }}</span>
            </div>
            <el-button size="small" @click="deletePasskey(pk)" :loading="deletingPasskeyId === pk.id">{{$t('delete')}}</el-button>
          </div>
          <el-button size="small" type="primary" :loading="registerPasskeyLoading" @click="registerPasskey">{{$t('passkeyAdd')}}</el-button>
        </div>
      </div>
    </div>
    <div class="del-email" v-perm="'my:delete'">
      <div class="title">{{$t('deleteUser')}}</div>
      <div style="color: var(--regular-text-color);">
        {{$t('delAccountMsg')}}
      </div>
      <div>
        <el-button type="primary" @click="deleteConfirm">{{$t('deleteUserBtn')}}</el-button>
      </div>
    </div>
    <el-dialog v-model="pwdShow" :title="$t('changePassword')" width="340">
      <div class="update-pwd">
        <el-input type="password" :placeholder="$t('newPassword')" v-model="form.password" autocomplete="off"/>
        <el-input type="password" :placeholder="$t('confirmPassword')" v-model="form.newPwd" autocomplete="off"/>
        <el-button type="primary" :loading="setPwdLoading" @click="submitPwd">{{$t('save')}}</el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script setup>
import {reactive, ref, defineOptions, computed} from 'vue'
import {resetPassword, userDelete, myOAuthAuthorize, myOAuthUnbind} from "@/request/my.js";
import {passkeyRegisterOptions, passkeyRegisterVerify, passkeyList, passkeyDelete} from "@/request/passkey.js";
import {useUserStore} from "@/store/user.js";
import router from "@/router/index.js";
import {accountSetName} from "@/request/account.js";
import {useAccountStore} from "@/store/account.js";
import {useI18n} from "vue-i18n";
import {Icon} from "@iconify/vue";

const { t } = useI18n()
const accountStore = useAccountStore()
const userStore = useUserStore();
const setPwdLoading = ref(false)
const setNameShow = ref(false)
const accountName = ref(null)
const bindLoading = ref(false)
const unbindLoading = ref(false)
const passkeySupported = ref(!!window.PublicKeyCredential)
const passkeyListData = ref([])
const registerPasskeyLoading = ref(false)
const deletingPasskeyId = ref(null)

const githubBinding = computed(() => {
  const bindings = userStore.user?.oauthBindings || []
  return bindings.find(item => item.provider === 'github') || null
})

defineOptions({
  name: 'setting'
})

function showSetName() {
  accountName.value = userStore.user.name
  setNameShow.value = true
}

function setName() {

  if (!accountName.value) {
    ElMessage({
      message: t('emptyUserNameMsg'),
      type: 'error',
      plain: true,
    })
    return;
  }

  setNameShow.value = false
  let name = accountName.value

  if (name === userStore.user.name) {
    return
  }

  userStore.user.name = accountName.value

  accountSetName(userStore.user.account.accountId,name).then(() => {
    ElMessage({
      message: t('saveSuccessMsg'),
      type: 'success',
      plain: true,
    })

    accountStore.changeUserAccountName = name

  }).catch(() => {
    userStore.user.name = name
  })
}

async function bindGitHub() {

  if (bindLoading.value) {
    return
  }

  bindLoading.value = true
  try {
    const { url } = await myOAuthAuthorize('github')
    sessionStorage.setItem('oauth_bind_provider', 'github')
    sessionStorage.setItem('oauth_bind_return', router.currentRoute.value.fullPath || '/settings')
    window.location.href = url
  } finally {
    bindLoading.value = false
  }
}

async function unbindGitHub() {

  if (unbindLoading.value) {
    return
  }

  unbindLoading.value = true

  try {
    await myOAuthUnbind('github')
    const bindings = userStore.user?.oauthBindings || []
    userStore.user.oauthBindings = bindings.filter(item => item.provider !== 'github')
    ElMessage({
      message: t('githubUnbindSuccess'),
      type: 'success',
      plain: true,
    })
  } finally {
    unbindLoading.value = false
  }
}

if (passkeySupported.value) {
  passkeyList().then(list => {
    passkeyListData.value = list || []
  }).catch(() => {})
}

async function registerPasskey() {
  if (registerPasskeyLoading.value) return
  registerPasskeyLoading.value = true
  try {
    const options = await passkeyRegisterOptions()
    const publicKeyOptions = {
      rp: options.rp,
      user: {
        id: Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        name: options.user.name,
        displayName: options.user.displayName
      },
      challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation,
      excludeCredentials: (options.excludeCredentials || []).map(cred => ({
        type: cred.type,
        id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
      }))
    }
    const credential = await navigator.credentials.create({ publicKey: publicKeyOptions })
    const toB64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const credentialData = {
      id: credential.id,
      type: credential.type,
      response: {
        clientDataJSON: toB64url(credential.response.clientDataJSON),
        attestationObject: toB64url(credential.response.attestationObject)
      }
    }
    const result = await passkeyRegisterVerify(credentialData, 'Passkey')
    passkeyListData.value.push(result)
    ElMessage({ message: t('passkeyRegisterSuccess'), type: 'success', plain: true })
  } catch (e) {
    if (e?.name !== 'NotAllowedError') {
      ElMessage({ message: e?.message || t('passkeyRegisterFailed'), type: 'error', plain: true })
    }
  } finally {
    registerPasskeyLoading.value = false
  }
}

async function deletePasskey(pk) {
  if (deletingPasskeyId.value) return
  deletingPasskeyId.value = pk.id
  try {
    await passkeyDelete(pk.id)
    passkeyListData.value = passkeyListData.value.filter(item => item.id !== pk.id)
    ElMessage({ message: t('delSuccessMsg'), type: 'success', plain: true })
  } finally {
    deletingPasskeyId.value = null
  }
}

const pwdShow = ref(false)
const form = reactive({
  password: '',
  newPwd: '',
})

const deleteConfirm = () => {
  ElMessageBox.confirm(t('delAccountConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    userDelete().then(() => {
      localStorage.removeItem('token');
      router.replace('/login');
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true,
      })
    })
  })
}


function submitPwd() {

  if (!form.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (form.password.length < 6) {
    ElMessage({
      message: t('pwdLengthMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (form.password !== form.newPwd) {
    ElMessage({
      message: t('confirmPwdFailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  setPwdLoading.value = true
  resetPassword(form.password).then(() => {
    ElMessage({
      message: t('saveSuccessMsg'),
      type: 'success',
      plain: true,
    })
    pwdShow.value = false
    setPwdLoading.value = false
    form.password = ''
    form.newPwd = ''
  }).catch(() => {
    setPwdLoading.value = false
  })

}

</script>
<style scoped lang="scss">
.box {
  padding: 40px 40px;

  @media (max-width: 767px) {
    padding: 30px 30px;
  }

  .update-pwd {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .title {
    font: var(--md-sys-typescale-title-large);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .container {
    font-size: 14px;
    display: grid;
    gap: 20px;
    margin-bottom: 40px;

    .item {
      display: grid;
      grid-template-columns: 50px 1fr;
      gap: 140px;
      position: relative;
      .user-name {
        display: grid;
        grid-template-columns: auto 1fr;
        span:first-child {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }

      .edit-name-input {
        position: absolute;
        bottom: -6px;
        .el-input {
          width: min(200px,calc(100vw - 222px));
        }
      }

      .edit-name {
        color: var(--md-sys-color-primary);
        padding-left: 10px;
        cursor: pointer;
        font-weight: 500;
      }

      .oauth-bind {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        justify-content: space-between;

        .oauth-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .oauth-name {
          font-weight: 500;
        }

        .oauth-sub {
          font-size: 12px;
          color: var(--regular-text-color);
        }
      }

      @media (max-width: 767px) {
        gap: 70px;
      }

      .passkey-manage {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .passkey-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .passkey-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .passkey-name {
          font-weight: 500;
        }
      }

      div:first-child {
        font-weight: bold;
      }

      div:last-child {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  }

  .del-email {
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    padding: 24px;
    border-radius: var(--md-sys-shape-corner-large);

    .title {
      color: var(--md-sys-color-on-error-container);
    }
  }
}
</style>
