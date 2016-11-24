import m from 'mithril'
import auth from '../service/auth'

function controller() {

    var self = this

    //TODO: make active class?
    self.curRoute = null

    self.findRoute = function () {
        if(m.route()) {
            self.curRoute = m.route()
            console.log("route found", self.curRoute)
        } else {
            setTimeout(self.findRoute, 100)
        }
    }


}

function view() {

    var loginLi = ""
    var registerLi = ""
    var exitLi = ""

     if(!auth.isLogged()) {
        loginLi = <li><a href="/#/login">Login</a></li>
        registerLi = <li><a href="/#/register">Register</a></li>
    } else {
        exitLi = <li><a href="/#/exit">Exit</a></li>
    }

    return (
        <div className="menu">
            <ul>
                <li><a href="/#/">Home</a></li>

                    {loginLi}
                    {registerLi}
                    {exitLi}

            </ul>
        </div>
    );
}

export default { view, controller }