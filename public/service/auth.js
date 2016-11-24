import store from 'store'
import http from './http'

function login (username, password) {
	return http.post("/user/auth/login", {username: username, password: password})
}

function register (username, password) {
    return http.post("/user/auth/register", {username: username, password: password})
}

function isLogged () {
    return store.get("token")
}

function setLogged (token) {
    return store.set("token", token)
}

function exit () {
    return store.clear("token")
}

export default { login, register, isLogged, setLogged, exit }

