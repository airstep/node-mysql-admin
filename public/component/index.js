import m from 'mithril' 
import auth from '../service/auth' 

function controller() {

	if(!auth.isLogged()) {
		return m.route("/login")
	}

	var self = this
	self.boards = m.prop([])

	boardService.list().then(function (r) {
		if(r.code == 200) {
			self.boards = m.prop(r.payload)
		} else {
			alert(r.message)
		}
	})

	self.goBoard = function (b) {
		m.route("/board/" + b.id)
	}

}

function view (ctrl) {
    return (
    	<div>
    		Index
    	</div>
    );
}

export default { view, controller }

