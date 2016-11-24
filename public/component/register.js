import m from 'mithril'
import auth from '../service/auth'

function controller() {

	//redirect to / because user seems logged
	if(auth.isLogged()) {
		return m.route("/")
	}

	var self = this

	self.username = m.prop("")
	self.password = m.prop("")

	self.register = function () {
		auth.register(self.username(), self.password()).then(function (r) {
			if(r.code == 200) {
				auth.setLogged(r.payload.token)
				document.location.href = "/"
			} else {
				alert(r.message)
			}
		})
	}
}

function view (ctrl) {
   return (
    	<div className="auth-form">

			<input 
			className="input" 
			type="text" 
			placeholder="Username" 
			onchange={m.withAttr('value', ctrl.username)}
			value={ctrl.username()}
			/>

			<div className="t" />

			<input 
			className="input" 
			type="text" 
			placeholder="Password" 
			onchange={m.withAttr('value', ctrl.password)}
			value={ctrl.password()}
			/>

			<div className="t" />

			<button onclick={ctrl.register}>Register</button>
    	</div>
    );
}

export default { view, controller }

