import m from 'mithril'
import auth from '../service/auth'

function controller() {

	if(!auth.isLogged()) {
		return m.route("/login")
	}
	
	auth.exit()
	document.location.href = "/"
}

function view (ctrl) {
    return (
    	<div>
    		Exiting from system...
    	</div>
    );
}

export default { view, controller }

