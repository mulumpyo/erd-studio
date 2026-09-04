import { reactive } from 'vue'

export const registerDraft = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreed: false,
})

export const clearRegisterDraft = () => {
  registerDraft.name = ''
  registerDraft.email = ''
  registerDraft.password = ''
  registerDraft.confirmPassword = ''
  registerDraft.agreed = false
}
